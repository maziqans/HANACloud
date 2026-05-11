from django.contrib import admin
from .models import CloudFile

@admin.register(CloudFile)
class CloudFileAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'category', 'file_size', 'updated_at')
    list_filter = ('category', 'user')