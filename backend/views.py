from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.db.models import Sum
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
    files = CloudFile.objects.filter(user=request.user).order_by('-uploaded_at')
    data = [
        {
            "id": str(f.id),
            "name": f.name,
            "item_type": "FILE",
            "size_bytes": f.file_size,
            "updated_at": f.uploaded_at.isoformat()
        } for f in files
    ]
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_files(request):
    for f in request.FILES.getlist('files'):
        CloudFile.objects.create(user=request.user, file=f)
    return Response({"message": "Files uploaded successfully"})

@api_view(['GET'])
@permission_classes([AllowAny]) # Standard HTML anchor links won't pass JWT headers easily
def download_file(request, file_id):
    cloud_file = get_object_or_404(CloudFile, id=file_id)
    return FileResponse(cloud_file.file.open('rb'), as_attachment=True, filename=cloud_file.name)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def move_to_trash(request, item_id):
    CloudFile.objects.filter(id=item_id, user=request.user).delete()
    return Response({"message": "Item moved to trash"})

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