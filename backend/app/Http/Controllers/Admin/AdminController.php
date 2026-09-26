<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\Request;

abstract class AdminController extends Controller
{
    protected function orgId(Request $request): int
    {
        $user = $request->user();

        if ($user->isSuperAdmin()) {
            $orgId = (int) $request->header('X-Impersonated-Org');
            abort_if($orgId === 0 || !Organization::where('id', $orgId)->exists(), 403, 'Bog\'cha ID noto\'g\'ri.');
            return $orgId;
        }

        return (int) $user->organization_id;
    }
}
