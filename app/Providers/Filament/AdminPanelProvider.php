<?php

namespace App\Providers\Filament;

use App\Filament\Pages\HomeDashboard;
use App\Filament\Pages\Login;
use App\Filament\Pages\StatusPage;
use App\Filament\Plugins\ApiKeyPlugin;
use App\Filament\Resources\ApiKeyResource;
use App\Filament\Resources\LogMessageResource;
use App\Filament\Resources\NotificationHistoryResource;
use Awcodes\FilamentQuickCreate\QuickCreatePlugin;
use Filament\Enums\ThemeMode;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Navigation\MenuItem;
use Filament\Navigation\NavigationItem;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Support\Enums\MaxWidth;
use Filament\View\PanelsRenderHook;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\AuthenticateSession;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use pxlrbt\FilamentSpotlight\SpotlightPlugin;

class AdminPanelProvider extends PanelProvider
{
    public const array PRIMARY_COLOR = Color::Teal;

    /**
     * PriceBuddies: greys taken from My Audiobook Collection
     * (950 = --bg #0e1014, 900 = --panel #16191f, 800 = --panel2 #1c2027,
     * 700 = --line #262b34, 400 = --dim #a2a9b8).
     */
    public const array GRAY_COLOR = [
        50 => '248, 249, 251',
        100 => '238, 240, 243',
        200 => '226, 229, 234',
        300 => '200, 205, 214',
        400 => '162, 169, 184',
        500 => '120, 128, 142',
        600 => '75, 82, 96',
        700 => '38, 43, 52',
        800 => '28, 32, 39',
        900 => '22, 25, 31',
        950 => '14, 16, 20',
    ];

    /**
     * Soft purple/cyan glow behind the page, as in My Audiobook Collection (dark mode only).
     * Like there, both hues turn 37 degrees a day (--day, set by the script below, also at midnight).
     */
    public const string BACKGROUND_STYLE = '<style>
        .dark .fi-body {
            background:
                radial-gradient(1500px 1100px at 4% 0%, hsl(calc(252 + var(--day, 0)) 100% 68% / .34), transparent 68%),
                radial-gradient(1400px 1050px at 96% 96%, hsl(calc(188 + var(--day, 0)) 86% 53% / .30), transparent 66%),
                #0e1014;
            background-attachment: fixed;
        }
        .dark .fi-topbar > nav { background: transparent; box-shadow: none; --tw-ring-color: transparent; }
        .dark .fi-sidebar, .dark .fi-sidebar-header { background: transparent; }
    </style>
    <script>
        (function () {
            var paint = function () {
                var now = new Date();
                var day = (Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000) * 37) % 360;
                document.documentElement.style.setProperty("--day", String(day));
                var midnight = new Date();
                midnight.setHours(24, 0, 5, 0);
                setTimeout(paint, Math.max(1000, midnight.getTime() - Date.now()));
            };
            paint();
        })();
    </script>';

    public const array DEFAULT_PAGINATION = [25, 50, 100, 'all'];

    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->brandLogo(fn () => view('filament.logo'))
            ->favicon(asset('/favicon.ico'))
            ->login(Login::class)
            ->maxContentWidth(MaxWidth::Full)
            ->colors([
                'primary' => self::PRIMARY_COLOR,
                'gray' => self::GRAY_COLOR,
            ])
            // PriceBuddies: dark look shared with My Audiobook Collection.
            ->defaultThemeMode(ThemeMode::Dark)
            ->renderHook(PanelsRenderHook::HEAD_END, fn (): string => self::BACKGROUND_STYLE)
            ->navigationItems([
                NavigationItem::make('Help')
                    ->group('System')
                    ->sort(1000)
                    ->url(config('price_buddy.help_url'), shouldOpenInNewTab: true)
                    ->icon('heroicon-o-question-mark-circle'),
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\\Filament\\Pages')
            ->pages([
                HomeDashboard::class,
                StatusPage::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\\Filament\\Widgets')
            ->widgets([
                // These get auto discovered, if not add manually.
            ])
            ->plugins([
                ApiKeyPlugin::make(),
                SpotlightPlugin::make(),
                QuickCreatePlugin::make()
                    ->excludes([
                        LogMessageResource::class,
                    ]),
            ])
            ->userMenuItems([
                MenuItem::make()
                    ->label('Notifications')
                    ->icon('heroicon-o-bell')
                    ->url(fn (): string => NotificationHistoryResource::getUrl('index')),
                MenuItem::make()
                    ->label('API keys')
                    ->icon('heroicon-o-key')
                    ->url(fn (): string => ApiKeyResource::getUrl('index')),
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ])
            ->breadcrumbs(false)
            ->databaseNotifications();
    }
}
