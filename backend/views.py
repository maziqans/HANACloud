from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Sum, Count, Q
import os
from core.models import CloudFile, UserProfile

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
        files_qs = CloudFile.objects.filter(user=request.user, parent_id=parent_id, is_trashed=False)
    else:
        files_qs = CloudFile.objects.filter(user=request.user, parent__isnull=True, is_trashed=False)
    
    files_qs = files_qs.annotate(
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
def upload_files(request):
    parent_id = request.data.get('parent_id')
    parent = None
    if parent_id and parent_id != 'null':
        parent = get_object_or_404(CloudFile, id=parent_id, user=request.user)
        
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
        parent = get_object_or_404(CloudFile, id=parent_id, user=request.user)
    
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
    item = get_object_or_404(CloudFile, id=item_id, user=request.user)
    is_starred = request.data.get('is_starred', True)
    item.is_starred = is_starred
    item.save(update_fields=['is_starred'])
    return Response({"message": f"Item {'starred' if is_starred else 'unstarred'}"})

@api_view(['GET'])
@permission_classes([AllowAny]) # Standard HTML anchor links won't pass JWT headers easily
def download_file(request, file_id):
    cloud_file = get_object_or_404(CloudFile, id=file_id)
    
    cloud_file.last_viewed_at = timezone.now()
    cloud_file.save(update_fields=['last_viewed_at'])
    
    ext = os.path.splitext(cloud_file.name)[1].lower()
    inline_exts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.mp4', '.webm', '.ogg', '.mp3', '.wav']
    as_attachment = ext not in inline_exts
    return FileResponse(cloud_file.file.open('rb'), as_attachment=as_attachment, filename=cloud_file.name)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def move_to_trash(request, item_id):
    item = get_object_or_404(CloudFile, id=item_id, user=request.user)
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

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def empty_trash(request):
    # Calling .delete() triggers our physical post_delete signals!
    CloudFile.objects.filter(user=request.user, is_trashed=True).delete()
    return Response({"message": "Trash emptied"})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def permanent_delete(request, item_id):
    CloudFile.objects.filter(id=item_id, user=request.user).delete()
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