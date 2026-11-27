<?php

namespace App\Models;

use App\Enums\NotificationMethods;
use App\Enums\Role;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Models\Contracts\HasAvatar;
use Filament\Panel;
use Filament\Panel\Concerns\HasNotifications;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property string $name
 * @property string $email
 * @property array $settings
 * @property \App\Enums\Role $role
 */
class User extends Authenticatable implements FilamentUser, HasAvatar
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasNotifications, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'settings',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'settings' => 'array',
            'role' => Role::class,
        ];
    }

    public function stores(): HasMany
    {
        return $this->hasMany(Store::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * Get notification setting(s) for a specific method.
     */
    public function getNotificationSettings(NotificationMethods $method, string $settingPath = '', mixed $default = null): mixed
    {
        return data_get(
            $this->settings,
            'notifications.'.$method->value.($settingPath ? '.'.$settingPath : ''),
            $default
        );
    }

    /**
     * Set Pushover user key.
     *
     * @see https://github.com/laravel-notification-channels/pushover?tab=readme-ov-file#advanced-usage-and-configuration
     *
     * Other notification channels may implement user settings differently.
     */
    public function routeNotificationForPushover()
    {
        return $this->getNotificationSettings(NotificationMethods::Pushover, 'user_key');
    }

    /**
     * Determine whether the user has the Admin role.
     */
    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }

    /** PriceBuddies: folder (under public/) holding the avatars a user can pick. */
    public const string AVATAR_PATH = 'images/avatars';

    /** PriceBuddies: folder on the public disk for pictures users upload themselves. */
    public const string AVATAR_UPLOAD_DIR = 'avatars';

    /**
     * Avatar file names a user can pick, e.g. "cartoon-01.svg" (svg, png, jpg or webp).
     *
     * @return list<string>
     */
    public static function avatarChoices(): array
    {
        // No GLOB_BRACE: it is missing on musl (Alpine) builds of PHP.
        $files = array_filter(
            glob(public_path(self::AVATAR_PATH.'/*')) ?: [],
            fn (string $file): bool => in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['svg', 'png', 'jpg', 'jpeg', 'webp'], true),
        );

        return array_values(array_map('basename', $files));
    }

    /**
     * The picked avatar, or null for Filament's default (initials).
     */
    public function getFilamentAvatarUrl(): ?string
    {
        // An uploaded picture wins over a bundled choice.
        $upload = data_get($this->settings, 'avatar_upload');

        if (is_string($upload) && str_starts_with($upload, self::AVATAR_UPLOAD_DIR.'/') && ! str_contains($upload, '..')
            && Storage::disk('public')->exists($upload)) {
            // asset() rather than Storage::url(): APP_URL is often not set on self-hosted installs.
            return asset('storage/'.$upload);
        }

        $avatar = data_get($this->settings, 'avatar');

        if (! is_string($avatar) || ! in_array($avatar, self::avatarChoices(), true)) {
            return null;
        }

        return asset(self::AVATAR_PATH.'/'.$avatar);
    }

    /**
     * All users can access panel.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        return true;
    }
}
