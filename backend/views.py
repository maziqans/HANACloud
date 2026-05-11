from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
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