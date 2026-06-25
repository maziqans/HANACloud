"""
URL configuration for core project.
"""
from django.contrib import admin
from django.urls import path
import views
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/users/me/', views.current_user, name='current_user'),
    path('api/users/search/', views.search_users, name='search_users'),
    
    path('api/drive/', views.drive_items, name='drive_items'),
    path('api/drive/<int:item_id>/', views.move_to_trash, name='move_to_trash'),
    path('api/drive/star/<int:item_id>/', views.toggle_star, name='toggle_star'),
    path('api/upload/single/', views.upload_single, name='upload_single'),
    path('api/upload/', views.upload_files, name='upload_files'),
    path('api/create-folder/', views.create_folder, name='create_folder'),
    path('api/download/<int:file_id>/', views.download_file, name='download_file'),
    path('api/thumbnail/<int:file_id>/', views.file_thumbnail, name='file_thumbnail'),
    path('api/download-folder/<int:folder_id>/', views.download_folder, name='download_folder'),
    
    path('api/recent/', views.recent_items, name='recent_items'),
    path('api/starred/', views.starred_items, name='starred_items'),
    path('api/trash/', views.trash_items, name='trash_items'),
    path('api/trash/empty/', views.empty_trash, name='empty_trash'),
    path('api/drive/permanent/<int:item_id>/', views.permanent_delete, name='permanent_delete'),
    path('api/rename/<str:item_id>/', views.rename_item, name='rename_item'),
    
    path('api/profile/', views.profile_settings, name='profile_settings'),
    path('api/storage/summary/', views.storage_summary, name='storage_summary'),
    path('api/storage/request/', views.request_storage, name='request_storage'),
    path('api/account/', views.delete_account, name='delete_account'),

    path('api/share/requests/', views.pending_access_requests),
    path('api/share/requests/<int:req_id>/<str:action>/', views.review_access_request),
    path('api/shared/<str:token>/request/', views.request_access),
    path('api/shared/<str:token>/save/', views.save_shared_item),
    
    path('api/share/<str:item_id>/', views.share_item),
    path('api/shared/<str:token>/', views.shared_item_info),

    path('api/move/', views.move_items),
    path('api/copy/', views.copy_items),

    path('api/shared-with-me/', views.shared_with_me_items),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)