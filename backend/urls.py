"""
URL configuration for core project.
"""
from django.contrib import admin
from django.urls import path
import views
from rest_framework_simplejwt.views import TokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/users/me/', views.current_user, name='current_user'),
    
    path('api/profile/', views.profile_settings, name='profile_settings'),
    path('api/storage/', views.storage_info, name='storage_info'),
    path('api/storage/request/', views.request_storage, name='request_storage'),
    path('api/account/', views.delete_account, name='delete_account'),
]