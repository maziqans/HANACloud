from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import CloudFile, UserProfile

@admin.register(CloudFile)
class CloudFileAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'category', 'file_size', 'updated_at')
    list_filter = ('category', 'user')

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Storage Quota'

class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)

# Re-register UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)