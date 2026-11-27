<?php

namespace Tests\Unit\Models;

use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UserAvatarTest extends TestCase
{
    public function test_bundled_avatars_are_offered(): void
    {
        $choices = User::avatarChoices();

        $this->assertGreaterThanOrEqual(50, count($choices));
        $this->assertContains('cartoon-01.svg', $choices);
    }

    public function test_picked_avatar_becomes_the_filament_avatar_url(): void
    {
        $user = new User(['settings' => ['avatar' => 'cartoon-05.svg']]);

        $this->assertSame(asset('images/avatars/cartoon-05.svg'), $user->getFilamentAvatarUrl());
    }

    public function test_no_or_unknown_avatar_falls_back_to_initials(): void
    {
        $this->assertNull((new User(['settings' => []]))->getFilamentAvatarUrl());
        $this->assertNull((new User(['settings' => ['avatar' => '']]))->getFilamentAvatarUrl());
        $this->assertNull((new User(['settings' => ['avatar' => '../../.env']]))->getFilamentAvatarUrl());
    }

    public function test_uploaded_picture_wins_over_bundled_choice(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('avatars/me.png', 'png');

        $user = new User(['settings' => ['avatar' => 'cartoon-05.svg', 'avatar_upload' => 'avatars/me.png']]);
        $this->assertSame(asset('storage/avatars/me.png'), $user->getFilamentAvatarUrl());

        $missing = new User(['settings' => ['avatar' => 'cartoon-05.svg', 'avatar_upload' => 'avatars/gone.png']]);
        $this->assertSame(asset('images/avatars/cartoon-05.svg'), $missing->getFilamentAvatarUrl());

        $outside = new User(['settings' => ['avatar_upload' => '../.env']]);
        $this->assertNull($outside->getFilamentAvatarUrl());
    }
}
