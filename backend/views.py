from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

@api_view(['POST'])
@permission_classes([AllowAny]) # Note: Change to IsAuthenticated once login is wired up
def profile_settings(request):
    # Here you would map to request.user.set_password(request.data['password'])
    # or save the uploaded avatar to request.user.profile.avatar
    return Response({"message": "Profile updated successfully"})

@api_view(['GET'])
@permission_classes([AllowAny])
def storage_info(request):
    # Mocking your 5.5TB pool
    return Response({
        "used_bytes": 1024 * 1024 * 1024 * 500, # 500GB mock usage
        "total_bytes": 1024 * 1024 * 1024 * 1024 * 5.5, # 5.5TB total capacity
        "breakdown": {
            "videos": 1024 * 1024 * 1024 * 250,    # 250GB
            "images": 1024 * 1024 * 1024 * 150,    # 150GB
            "documents": 1024 * 1024 * 1024 * 50,  # 50GB
            "others": 1024 * 1024 * 1024 * 50,     # 50GB
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