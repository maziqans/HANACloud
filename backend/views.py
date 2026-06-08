from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Sum, Count, Q
import os
from core.models import CloudFile, UserProfile, FileAccess, AccessRequest
from django.contrib.auth.models import User

def check_edit_access(user, folder):
    """Helper to check if a user is allowed to modify files inside a target folder."""
    if not folder: return False # Never allow modifying someone else's absolute root drive
    if folder.user == user: return True
    if folder.share_mode == 'PUBLIC': return True
    
    accessible_ids = set(FileAccess.objects.filter(user=user, role='EDITOR').values_list('file_id', flat=True))
    curr = folder
    while curr:
        if curr.share_mode == 'PUBLIC' or curr.user == user or curr.id in accessible_ids:
            return True
        curr = curr.parent
    return False

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    avatar_url = None
    if hasattr(request.user, 'userprofile') and request.user.userprofile.avatar:
        avatar_url = request.build_absolute_uri(request.user.userprofile.avatar.url)
        
    return Response({
        "username": request.user.username,
        "email": request.user.email,
        "first_name": request.user.first_name,
        "last_name": request.user.last_name,
        "avatar_url": avatar_url,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_users(request):
    query = request.GET.get('q', '')
    if len(query) < 2:
        return Response([])
    users = User.objects.filter(email__icontains=query).exclude(id=request.user.id)[:10]
    data = [{"email": u.email, "name": f"{u.first_name} {u.last_name}".strip() or u.username} for u in users]
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def profile_settings(request):
    user = request.user
    profile, created = UserProfile.objects.get_or_create(user=user)

    # Handle avatar upload or removal
    if 'avatar' in request.FILES:
        profile.avatar = request.FILES['avatar']
        profile.save()
    elif request.data.get('remove_avatar') == 'true':
        profile.avatar = None
        profile.save()

    # Handle password change
    if 'password' in request.data and request.data['password']:
        user.set_password(request.data['password'])
        
    # Handle basic info change
    if 'first_name' in request.data:
        user.first_name = request.data['first_name']
    if 'last_name' in request.data:
        user.last_name = request.data['last_name']
    if 'email' in request.data:
        user.email = request.data['email']
        
    user.save()

    return Response({"message": "Profile updated successfully"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def storage_summary(request):
    files = CloudFile.objects.filter(user=request.user)
    total_used = files.aggregate(Sum('file_size'))['file_size__sum'] or 0
    
    try:
        total_limit = request.user.userprofile.storage_limit_bytes
    except Exception:
        total_limit = 50 * 1024 * 1024 * 1024  # Fallback to 50GB if no profile exists yet

    def get_category_sum(cat):
        return files.filter(category=cat).aggregate(Sum('file_size'))['file_size__sum'] or 0

    return Response({
        "used_bytes": total_used,
        "total_bytes": total_limit,
        "breakdown": {
            "videos": get_category_sum('VIDEO'),
            "images": get_category_sum('IMAGE'),
            "documents": get_category_sum('DOCUMENT'),
            "others": get_category_sum('OTHER'),
        }
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def drive_items(request):
    parent_id = request.GET.get('parent_id')
    if parent_id and parent_id != 'null':
        parent = get_object_or_404(CloudFile, id=parent_id, is_trashed=False)
        
        # Verify if the user owns this folder OR if it was shared with them
        has_access = False
        if parent.share_mode == 'PUBLIC' or parent.user == request.user or parent.access_permissions.filter(user=request.user).exists():
            has_access = True
        else:
            # OPTIMIZATION: Prevent N+1 by fetching all allowed IDs into memory at once
            accessible_ids = set(FileAccess.objects.filter(user=request.user).values_list('file_id', flat=True))
            curr = parent.parent
            while curr:
                if curr.share_mode == 'PUBLIC' or curr.user == request.user or curr.id in accessible_ids:
                    has_access = True
                    break
                curr = curr.parent
        if not has_access:
            return Response({"error": "Unauthorized"}, status=403)
            
        files_qs = CloudFile.objects.filter(parent=parent, is_trashed=False)
    else:
        files_qs = CloudFile.objects.filter(user=request.user, parent__isnull=True, is_trashed=False)
    
    files_qs = files_qs.annotate(
        item_count_agg=Count('children', filter=Q(children__is_trashed=False))
    ).order_by('-is_folder', '-updated_at').values(
        'id', 'name', 'is_folder', 'file_size', 'updated_at', 'item_count_agg', 'is_starred', 'user_id', 'share_mode'
    )
    
    editor_accessible_ids = set(FileAccess.objects.filter(user=request.user, role='EDITOR').values_list('file_id', flat=True))
    can_edit_parent = True
    if parent_id and parent_id != 'null':
        can_edit_parent = check_edit_access(request.user, parent)
        
    data = []
    for f in files_qs:
        name = f['name']
        item_can_edit = can_edit_parent or (f['user_id'] == request.user.id) or (f['share_mode'] == 'PUBLIC') or (f['id'] in editor_accessible_ids)
        data.append({
            "id": str(f['id']),
            "name": name.split('/')[-1] if '/' in name else name,
            "item_type": "FOLDER" if f['is_folder'] else "FILE",
            "size_bytes": f['file_size'],
            "updated_at": f['updated_at'].isoformat() if f['updated_at'] else None,
            "item_count": f['item_count_agg'] if f['is_folder'] else 0,
            "is_starred": f['is_starred'],
            "can_edit": item_can_edit
        })
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_files(request):
    parent_id = request.data.get('parent_id')
    parent = None
    if parent_id and parent_id != 'null':
        parent = get_object_or_404(CloudFile, id=parent_id)
        if not check_edit_access(request.user, parent):
            return Response({"error": "You do not have editor permission for this folder"}, status=403)
        
    chunk_index = request.data.get('chunk_index')
    total_chunks = request.data.get('total_chunks')
    
    if chunk_index is not None and total_chunks is not None:
        from django.conf import settings
        import shutil
        
        chunk_index = int(chunk_index)
        total_chunks = int(total_chunks)
        file_id = request.data.get('file_id')
        filename = request.data.get('filename')
        
        files_list = request.FILES.getlist('files')
        if not files_list:
            return Response({"error": "No file chunk provided"}, status=400)
        chunk = files_list[0]
        
        temp_dir = os.path.join(settings.MEDIA_ROOT, 'tmp', str(file_id))
        os.makedirs(temp_dir, exist_ok=True)
        
        chunk_path = os.path.join(temp_dir, str(chunk_index))
        with open(chunk_path, 'wb+') as f:
            for data in chunk.chunks():
                f.write(data)
                
        if len(os.listdir(temp_dir)) == total_chunks:
            final_path = os.path.join(settings.MEDIA_ROOT, 'tmp', f"final_{file_id}")
            with open(final_path, 'wb+') as dest_file:
                for i in range(total_chunks):
                    part_path = os.path.join(temp_dir, str(i))
                    if os.path.exists(part_path):
                        with open(part_path, 'rb') as source_file:
                            dest_file.write(source_file.read())
            
            from django.core.files import File
            with open(final_path, 'rb') as f:
                django_file = File(f, name=filename)
                CloudFile.objects.create(user=request.user, file=django_file, parent=parent, name=filename)
            
            shutil.rmtree(temp_dir, ignore_errors=True)
            if os.path.exists(final_path):
                os.remove(final_path)
            
        return Response({"message": "Chunk processed"})
        
    for f in request.FILES.getlist('files'):
        CloudFile.objects.create(user=request.user, file=f, parent=parent)
    return Response({"message": "Files uploaded successfully"})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_folder(request):
    name = request.data.get('name')
    parent_id = request.data.get('parent_id')
    if not name:
        return Response({"error": "Folder name is required"}, status=400)
    
    parent = None
    if parent_id and parent_id != 'null':
        parent = get_object_or_404(CloudFile, id=parent_id)
        if not check_edit_access(request.user, parent):
            return Response({"error": "You do not have editor permission for this folder"}, status=403)
    
    folder = CloudFile.objects.create(user=request.user, name=name, is_folder=True, category='FOLDER', parent=parent)
    
    # Physically create the folder on disk
    from django.conf import settings
    path_parts = [name]
    curr = parent
    while curr:
        path_parts.insert(0, curr.name)
        curr = curr.parent
    full_path = os.path.join(settings.MEDIA_ROOT, f'user_{request.user.username}', *path_parts)
    os.makedirs(full_path, exist_ok=True)
    
    return Response({"message": "Folder created successfully", "id": folder.id})

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def toggle_star(request, item_id):
    item = get_object_or_404(CloudFile, id=item_id)
    is_starred = request.data.get('is_starred', True)
    item.is_starred = is_starred
    item.save(update_fields=['is_starred'])
    return Response({"message": f"Item {'starred' if is_starred else 'unstarred'}"})

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def share_item(request, item_id):
    import uuid
    item = get_object_or_404(CloudFile, id=item_id, user=request.user)
    if not item.share_token:
        item.share_token = uuid.uuid4().hex
        item.save(update_fields=['share_token'])
        
    if request.method == 'POST':
        share_mode = request.data.get('share_mode')
        if share_mode in ['PUBLIC', 'RESTRICTED']:
            item.share_mode = share_mode
            item.save(update_fields=['share_mode'])
        
        permissions_data = request.data.get('permissions')
        if permissions_data is not None:
            users_to_add = []
            for p in permissions_data:
                email = p.get('email')
                if email:
                    try:
                        u = User.objects.get(email=email)
                        users_to_add.append((u, p.get('role', 'VIEWER')))
                    except User.DoesNotExist:
                        return Response({"error": f"User with email '{email}' not found. They must have an account."}, status=400)
            
            item.access_permissions.all().delete()
            for u, role in users_to_add:
                FileAccess.objects.create(file=item, user=u, role=role)
    
    # Use select_related to prevent N+1 database queries when fetching user emails
    perms = [{"email": p.user.email, "role": p.role} for p in item.access_permissions.select_related('user').all()]
    return Response({
        "share_token": item.share_token,
        "share_mode": item.share_mode,
        "permissions": perms
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def shared_item_info(request, token):
    item = get_object_or_404(CloudFile, share_token=token, is_trashed=False)
    
    # Check Auth
    auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
    auth_user = None
    if auth_token:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        try:
            validated_token = JWTAuthentication().get_validated_token(auth_token)
            auth_user = JWTAuthentication().get_user(validated_token)
        except Exception:
            pass

    if item.share_mode == 'RESTRICTED':
        if not auth_user or not auth_user.is_authenticated:
            return Response({"error": "This item is restricted. Please log in to view it."}, status=401)
        has_access = (item.user == auth_user) or item.access_permissions.filter(user=auth_user).exists()
        if not has_access:
            # Item is restricted and they aren't invited -> Send Request Status
            req = AccessRequest.objects.filter(file=item, user=auth_user).first()
            status = req.status if req else 'NONE'
            return Response({"error": "access_denied", "request_status": status, "file_name": item.name}, status=403)
            
        user_role = 'OWNER' if item.user == auth_user else item.access_permissions.get(user=auth_user).role
    else:
        if auth_user and auth_user.is_authenticated:
            if item.user == auth_user:
                user_role = 'OWNER'
            else:
                has_access = item.access_permissions.filter(user=auth_user).exists()
                user_role = 'VIEWER' if has_access else 'PUBLIC_VIEWER'
        else:
            user_role = 'PUBLIC_VIEWER'

    data = {
        "id": str(item.id),
        "name": item.name.split('/')[-1] if '/' in item.name else item.name,
        "item_type": "FOLDER" if item.is_folder else "FILE",
        "size_bytes": item.file_size,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "share_token": item.share_token,
        "owner": item.user.first_name or item.user.username,
        "user_role": user_role,
        "is_saved": user_role in ['VIEWER', 'EDITOR', 'OWNER'],
    }
    
    if item.is_folder:
        children = item.children.filter(is_trashed=False).order_by('-is_folder', 'name')
        data["children"] = []
        for c in children:
            data["children"].append({
                "id": str(c.id),
                "name": c.name.split('/')[-1] if '/' in c.name else c.name,
                "item_type": "FOLDER" if c.is_folder else "FILE",
                "size_bytes": c.file_size,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            })
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shared_with_me_items(request):
    files_qs = CloudFile.objects.filter(
        access_permissions__user=request.user,
        is_trashed=False
    ).annotate(
        item_count_agg=Count('children', filter=Q(children__is_trashed=False))
    ).order_by('-is_folder', '-updated_at').values(
        'id', 'name', 'is_folder', 'file_size', 'updated_at', 'item_count_agg', 'is_starred', 'user__username', 'user__first_name', 'user_id', 'share_mode'
    )
    
    editor_accessible_ids = set(FileAccess.objects.filter(user=request.user, role='EDITOR').values_list('file_id', flat=True))
    
    data = []
    for f in files_qs:
        name = f['name']
        owner_name = f['user__first_name'] or f['user__username']
        item_can_edit = (f['user_id'] == request.user.id) or (f['share_mode'] == 'PUBLIC') or (f['id'] in editor_accessible_ids)
        data.append({
            "id": str(f['id']),
            "name": name.split('/')[-1] if '/' in name else name,
            "item_type": "FOLDER" if f['is_folder'] else "FILE",
            "size_bytes": f['file_size'],
            "updated_at": f['updated_at'].isoformat() if f['updated_at'] else None,
            "item_count": f['item_count_agg'] if f['is_folder'] else 0,
            "is_starred": f['is_starred'],
            "owner": owner_name,
            "can_edit": item_can_edit
        })
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_shared_item(request, token):
    item = get_object_or_404(CloudFile, share_token=token, is_trashed=False)
    if item.share_mode == 'PUBLIC' and item.user != request.user:
        FileAccess.objects.get_or_create(file=item, user=request.user, defaults={'role': 'VIEWER'})
    return Response({"message": "Saved successfully"})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_access(request, token):
    item = get_object_or_404(CloudFile, share_token=token)
    AccessRequest.objects.update_or_create(file=item, user=request.user, defaults={'status': 'PENDING'})
    return Response({"message": "Access request sent successfully"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_access_requests(request):
    requests = AccessRequest.objects.filter(file__user=request.user, status='PENDING').select_related('user', 'file')
    data = [{"id": r.id, "user_email": r.user.email, "file_name": r.file.name, "created_at": r.created_at} for r in requests]
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_access_request(request, req_id, action):
    req = get_object_or_404(AccessRequest, id=req_id, file__user=request.user)
    if action == 'approve':
        req.status = 'APPROVED'
        req.save()
        FileAccess.objects.update_or_create(file=req.file, user=req.user, defaults={'role': 'VIEWER'})
    elif action == 'reject':
        req.status = 'REJECTED'
        req.save()
    return Response({"message": f"Request {action}d"})

@api_view(['GET'])
@permission_classes([AllowAny])
def file_thumbnail(request, file_id):
    cloud_file = get_object_or_404(CloudFile, id=file_id)
    
    token = request.GET.get('token')
    auth_user = request.user
    if token:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        try:
            validated_token = JWTAuthentication().get_validated_token(token)
            auth_user = JWTAuthentication().get_user(validated_token)
        except Exception:
            pass

    has_access = False
    if cloud_file.share_mode == 'PUBLIC':
        has_access = True
    elif auth_user and auth_user.is_authenticated:
        if cloud_file.user == auth_user or cloud_file.access_permissions.filter(user=auth_user).exists():
            has_access = True
            
    if not has_access:
        accessible_ids = set(FileAccess.objects.filter(user=auth_user).values_list('file_id', flat=True)) if auth_user and auth_user.is_authenticated else set()
        curr = cloud_file.parent
        while curr:
            if curr.share_mode == 'PUBLIC' or (auth_user and auth_user.is_authenticated and (curr.user == auth_user or curr.id in accessible_ids)):
                has_access = True
                break
            curr = curr.parent

    if not has_access:
        return Response({"error": "Unauthorized"}, status=403)

    # 1. Parse and Cap Dimensions
    try:
        w = int(request.GET.get('w', 400))
        h = int(request.GET.get('h', 400))
    except ValueError:
        w, h = 400, 400
        
    w = min(max(w, 10), 1200) # Enforce strict bounds (min 10px, max 1200px)
    h = min(max(h, 10), 1200)

    # 2. Deterministic Cache Naming
    from django.conf import settings
    cache_dir = os.path.join(settings.MEDIA_ROOT, 'thumbnail_cache')
    os.makedirs(cache_dir, exist_ok=True)
    
    cache_filename = f"thumb_{cloud_file.id}_{w}x{h}.webp"
    cached_file_path = os.path.join(cache_dir, cache_filename)

    # 3. Cache-First Logic (Zero CPU Overhead)
    if os.path.exists(cached_file_path):
        resp = FileResponse(open(cached_file_path, 'rb'), content_type='image/webp')
        resp['Cache-Control'] = 'public, max-age=31536000, immutable'
        return resp
        
    # 4. Processing Engine (Cache Miss)
    try:
        from PIL import Image, ImageOps
        source_field = cloud_file.thumbnail if cloud_file.thumbnail else cloud_file.file
        
        if not cloud_file.thumbnail and cloud_file.category == 'VIDEO' and cloud_file.file:
            import subprocess
            import tempfile
            from io import BytesIO
            with tempfile.NamedTemporaryFile(suffix='.jpg') as temp_thumb:
                video_path = cloud_file.file.path
                subprocess.run([
                    'ffmpeg', '-i', video_path, '-ss', '00:00:01.000', '-vframes', '1',
                    '-y', temp_thumb.name
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                img = Image.open(temp_thumb.name)
                img.thumbnail((400, 400))
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                thumb_io = BytesIO()
                img.save(thumb_io, format='WEBP', quality=65)
                from django.core.files.base import ContentFile
                cloud_file.thumbnail.save(f"thumb.webp", ContentFile(thumb_io.getvalue()), save=False)
                cloud_file.save(update_fields=['thumbnail'])
            source_field = cloud_file.thumbnail
        elif not cloud_file.thumbnail and cloud_file.category == 'IMAGE' and cloud_file.file:
            from io import BytesIO
            img = Image.open(cloud_file.file)
            img.thumbnail((400, 400))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            thumb_io = BytesIO()
            img.save(thumb_io, format='WEBP', quality=65)
            from django.core.files.base import ContentFile
            cloud_file.thumbnail.save(f"thumb.webp", ContentFile(thumb_io.getvalue()), save=False)
            cloud_file.save(update_fields=['thumbnail'])
            source_field = cloud_file.thumbnail
            
        if not source_field:
            raise FileNotFoundError()
            
        with source_field.open('rb') as f:
            img = Image.open(f)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Aggressively fit and crop mathematically
            img = ImageOps.fit(img, (w, h), Image.Resampling.LANCZOS)
            img.save(cached_file_path, format='WEBP', quality=80)
            
        resp = FileResponse(open(cached_file_path, 'rb'), content_type='image/webp')
        resp['Cache-Control'] = 'public, max-age=31536000, immutable'
        return resp
    except (FileNotFoundError, OSError, ValueError, Exception):
        # Handle missing originals or corrupted files gracefully
        resp = download_file._callback(request, file_id) 
        if isinstance(resp, FileResponse):
            resp['Cache-Control'] = 'public, max-age=86400'
        return resp

@api_view(['GET'])
@permission_classes([AllowAny]) # Standard HTML anchor links won't pass JWT headers easily
def download_file(request, file_id):
    cloud_file = get_object_or_404(CloudFile, id=file_id)
    
    # Authenticate via query token for secure media streaming and downloads
    token = request.GET.get('token')
    auth_user = request.user
    if token:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        try:
            validated_token = JWTAuthentication().get_validated_token(token)
            auth_user = JWTAuthentication().get_user(validated_token)
        except Exception:
            pass

    # Security Access Check
    has_access = False
    if cloud_file.share_mode == 'PUBLIC':
        has_access = True
    elif auth_user and auth_user.is_authenticated:
        if cloud_file.user == auth_user or cloud_file.access_permissions.filter(user=auth_user).exists():
            has_access = True
            
    # Inherit access if parent folder is explicitly shared
    if not has_access:
        accessible_ids = set(FileAccess.objects.filter(user=auth_user).values_list('file_id', flat=True)) if auth_user and auth_user.is_authenticated else set()
        curr = cloud_file.parent
        while curr:
            if curr.share_mode == 'PUBLIC' or (auth_user and auth_user.is_authenticated and (curr.user == auth_user or curr.id in accessible_ids)):
                has_access = True
                break
            curr = curr.parent

    if not has_access:
        return Response({"error": "Unauthorized to access this file."}, status=403)

    cloud_file.last_viewed_at = timezone.now()
    cloud_file.save(update_fields=['last_viewed_at'])
    
    force_download = request.GET.get('download') == '1'
    ext = os.path.splitext(cloud_file.name)[1].lower()
    inline_exts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.mp4', '.webm', '.ogg', '.mp3', '.wav']
    as_attachment = force_download or (ext not in inline_exts)
    resp = FileResponse(cloud_file.file.open('rb'), as_attachment=as_attachment, filename=cloud_file.name)
    if not as_attachment:
        resp['Cache-Control'] = 'public, max-age=86400' # Speeds up preview reloading drastically
    return resp

@api_view(['GET'])
@permission_classes([AllowAny])
def download_folder(request, folder_id):
    cloud_folder = get_object_or_404(CloudFile, id=folder_id, is_folder=True)
    
    token = request.GET.get('token')
    auth_user = request.user
    if token:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        try:
            validated_token = JWTAuthentication().get_validated_token(token)
            auth_user = JWTAuthentication().get_user(validated_token)
        except Exception:
            pass

    has_access = False
    if cloud_folder.share_mode == 'PUBLIC':
        has_access = True
    elif auth_user and auth_user.is_authenticated:
        if cloud_folder.user == auth_user or cloud_folder.access_permissions.filter(user=auth_user).exists():
            has_access = True
            
    if not has_access:
        accessible_ids = set(FileAccess.objects.filter(user=auth_user).values_list('file_id', flat=True)) if auth_user and auth_user.is_authenticated else set()
        curr = cloud_folder.parent
        while curr:
            if curr.share_mode == 'PUBLIC' or (auth_user and auth_user.is_authenticated and (curr.user == auth_user or curr.id in accessible_ids)):
                has_access = True
                break
            curr = curr.parent

    if not has_access:
        return Response({"error": "Unauthorized to access this folder."}, status=403)

    import tempfile
    import zipfile
    
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    
    def add_to_zip(zipf, folder, current_path=""):
        for child in folder.children.filter(is_trashed=False):
            if child.is_folder:
                add_to_zip(zipf, child, os.path.join(current_path, child.name))
            elif child.file and os.path.exists(child.file.path):
                arcname = os.path.join(current_path, child.name)
                zipf.write(child.file.path, arcname)

    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zipf:
        add_to_zip(zipf, cloud_folder)
        
    tmp.close()
    
    resp = FileResponse(open(tmp.name, 'rb'), as_attachment=True, filename=f"{cloud_folder.name}.zip")
    return resp

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def move_to_trash(request, item_id):
    item = get_object_or_404(CloudFile, id=item_id)
    if item.user != request.user:
        has_edit = False
        accessible_ids = set(FileAccess.objects.filter(user=request.user, role='EDITOR').values_list('file_id', flat=True))
        if item.id in accessible_ids:
            has_edit = True
        elif check_edit_access(request.user, item.parent):
            has_edit = True
            
        if not has_edit:
            return Response({"error": "No permission to delete"}, status=403)
        
    is_trashed = request.data.get('is_trashed', True)
    
    def set_trashed(folder, state):
        folder.is_trashed = state
        folder.save()
        for child in folder.children.all():
            set_trashed(child, state)
            
    set_trashed(item, is_trashed)
    return Response({"message": f"Item {'moved to trash' if is_trashed else 'restored'}"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trash_items(request):
    files_qs = CloudFile.objects.filter(user=request.user, is_trashed=True).annotate(
        item_count_agg=Count('children', filter=Q(children__is_trashed=True))
    ).order_by('-is_folder', '-updated_at').values(
        'id', 'name', 'is_folder', 'file_size', 'updated_at', 'item_count_agg', 'is_starred'
    )
    
    data = []
    for f in files_qs:
        name = f['name']
        data.append({
            "id": str(f['id']),
            "name": name.split('/')[-1] if '/' in name else name,
            "item_type": "FOLDER" if f['is_folder'] else "FILE",
            "size_bytes": f['file_size'],
            "updated_at": f['updated_at'].isoformat() if f['updated_at'] else None,
            "item_count": f['item_count_agg'] if f['is_folder'] else 0,
            "is_starred": f['is_starred']
        })
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_items(request):
    files_qs = CloudFile.objects.filter(user=request.user, is_trashed=False, is_folder=False, last_viewed_at__isnull=False).order_by('-last_viewed_at')[:20]
    files_qs = files_qs.values('id', 'name', 'file_size', 'updated_at', 'is_starred')
    
    data = []
    for f in files_qs:
        name = f['name']
        data.append({
            "id": str(f['id']),
            "name": name.split('/')[-1] if '/' in name else name,
            "item_type": "FILE",
            "size_bytes": f['file_size'],
            "updated_at": f['updated_at'].isoformat() if f['updated_at'] else None,
            "item_count": 0,
            "is_starred": f['is_starred']
        })
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def starred_items(request):
    files_qs = CloudFile.objects.filter(user=request.user, is_trashed=False, is_starred=True).annotate(
        item_count_agg=Count('children', filter=Q(children__is_trashed=False))
    ).order_by('-is_folder', '-updated_at').values(
        'id', 'name', 'is_folder', 'file_size', 'updated_at', 'item_count_agg', 'is_starred'
    )
    
    data = []
    for f in files_qs:
        name = f['name']
        data.append({
            "id": str(f['id']),
            "name": name.split('/')[-1] if '/' in name else name,
            "item_type": "FOLDER" if f['is_folder'] else "FILE",
            "size_bytes": f['file_size'],
            "updated_at": f['updated_at'].isoformat() if f['updated_at'] else None,
            "item_count": f['item_count_agg'] if f['is_folder'] else 0,
            "is_starred": f['is_starred']
        })
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def move_items(request):
    item_ids = request.data.get('item_ids', [])
    target_parent_id = request.data.get('target_parent_id')
    
    target_parent = None
    if target_parent_id and target_parent_id != 'null':
        target_parent = get_object_or_404(CloudFile, id=target_parent_id, is_folder=True)
        if not check_edit_access(request.user, target_parent):
            return Response({"error": "No permission to copy items here"}, status=403)
        
    items = CloudFile.objects.filter(id__in=item_ids)
    
    def is_descendant(folder, target):
        curr = target
        while curr:
            if curr.id == folder.id:
                return True
            curr = curr.parent
        return False

    for item in items:
        if item.user != request.user and not check_edit_access(request.user, item.parent):
            return Response({"error": f"No permission to move '{item.name}'"}, status=403)
        if item.is_folder and target_parent and is_descendant(item, target_parent):
            return Response({"error": f"Cannot move '{item.name}' into its own subfolder."}, status=400)
            
    items.update(parent=target_parent)
    return Response({"message": "Items moved successfully"})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def copy_items(request):
    item_ids = request.data.get('item_ids', [])
    target_parent_id = request.data.get('target_parent_id')
    
    target_parent = None
    if target_parent_id and target_parent_id != 'null':
        target_parent = get_object_or_404(CloudFile, id=target_parent_id, is_folder=True)
        if not check_edit_access(request.user, target_parent):
            return Response({"error": "No permission to move items here"}, status=403)
        
    items = CloudFile.objects.filter(id__in=item_ids)
    
    def is_descendant(folder, target):
        curr = target
        while curr:
            if curr.id == folder.id:
                return True
            curr = curr.parent
        return False
        
    for item in items:
        if item.is_folder and target_parent and is_descendant(item, target_parent):
            return Response({"error": f"Cannot copy '{item.name}' into its own subfolder."}, status=400)

    def duplicate_item(item, parent):
        new_item = CloudFile.objects.get(id=item.id)
        new_item.pk = None
        new_item.parent = parent
        new_item.user = request.user
        new_item.share_mode = 'RESTRICTED'
        new_item.share_token = None
        
        if parent == item.parent:
            new_item.name = f"{item.name} - Copy"
            
        if not item.is_folder and item.file:
            from django.core.files import File
            try:
                with open(item.file.path, 'rb') as f:
                    new_item.file.save(new_item.name, File(f), save=False)
            except Exception:
                pass
        else:
            new_item.file = None
            
        new_item.save()
        
        if item.is_folder:
            from django.conf import settings
            path_parts = [new_item.name]
            curr = parent
            while curr:
                path_parts.insert(0, curr.name)
                curr = curr.parent
            full_path = os.path.join(settings.MEDIA_ROOT, f'user_{request.user.username}', *path_parts)
            os.makedirs(full_path, exist_ok=True)
            
            for child in item.children.filter(is_trashed=False):
                duplicate_item(child, new_item)
                
    for item in items:
        duplicate_item(item, target_parent)
        
    return Response({"message": "Items copied successfully"})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def empty_trash(request):
    # Calling .delete() triggers our physical post_delete signals!
    CloudFile.objects.filter(user=request.user, is_trashed=True).delete()
    return Response({"message": "Trash emptied"})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def permanent_delete(request, item_id):
    item = get_object_or_404(CloudFile, id=item_id)
    if item.user != request.user:
        has_edit = False
        accessible_ids = set(FileAccess.objects.filter(user=request.user, role='EDITOR').values_list('file_id', flat=True))
        if item.id in accessible_ids:
            has_edit = True
        elif check_edit_access(request.user, item.parent):
            has_edit = True
            
        if not has_edit:
            return Response({"error": "No permission to delete"}, status=403)
    item.delete()
    return Response({"message": "Item permanently deleted"})

@api_view(['POST'])
@permission_classes([AllowAny])
def request_storage(request):
    reason = request.data.get('reason', 'No reason provided')
    # Here you would save to an Admin request table or trigger an email
    return Response({"message": "Storage request submitted successfully"})

@api_view(['DELETE'])
@permission_classes([AllowAny])
def delete_account(request):
    # request.user.delete()
    return Response({"message": "Account deleted successfully"})