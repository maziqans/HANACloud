from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.db.models import Sum
import os
from core.models import CloudFile

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    return Response({
        "username": request.user.username,
        "email": request.user.email,
        "first_name": request.user.first_name,
        "last_name": request.user.last_name,
    })

@api_view(['POST'])
@permission_classes([AllowAny]) # Note: Change to IsAuthenticated once login is wired up
def profile_settings(request):
    # Here you would map to request.user.set_password(request.data['password'])
    # or save the uploaded avatar to request.user.profile.avatar
    return Response({"message": "Profile updated successfully"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def storage_summary(request):
    files = CloudFile.objects.filter(user=request.user)
    total_used = files.aggregate(Sum('file_size'))['file_size__sum'] or 0
    total_limit = 50 * 1024 * 1024 * 1024  # Example: 50GB Limit

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
        files = CloudFile.objects.filter(user=request.user, parent_id=parent_id, is_trashed=False).order_by('-updated_at')
    else:
        files = CloudFile.objects.filter(user=request.user, parent__isnull=True, is_trashed=False).order_by('-updated_at')
    
    data = []
    for f in files:
        item_count = f.children.filter(is_trashed=False).count() if f.is_folder else 0
        data.append({
            "id": str(f.id),
            "name": f.name.split('/')[-1] if '/' in f.name else f.name,
            "item_type": "FOLDER" if f.is_folder else "FILE",
            "size_bytes": f.file_size,
            "updated_at": f.updated_at.isoformat(),
            "item_count": item_count
        })
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_files(request):
    parent_id = request.data.get('parent_id')
    parent = None
    if parent_id and parent_id != 'null':
        parent = get_object_or_404(CloudFile, id=parent_id, user=request.user)
        
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

@api_view(['GET'])
@permission_classes([AllowAny]) # Standard HTML anchor links won't pass JWT headers easily
def download_file(request, file_id):
    cloud_file = get_object_or_404(CloudFile, id=file_id)
    ext = os.path.splitext(cloud_file.name)[1].lower()
    inline_exts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt']
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
    files = CloudFile.objects.filter(user=request.user, is_trashed=True).order_by('-updated_at')
    data = []
    for f in files:
        item_count = f.children.filter(is_trashed=True).count() if f.is_folder else 0
        data.append({
            "id": str(f.id),
            "name": f.name.split('/')[-1] if '/' in f.name else f.name,
            "item_type": "FOLDER" if f.is_folder else "FILE",
            "size_bytes": f.file_size,
            "updated_at": f.updated_at.isoformat(),
            "item_count": item_count
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