<?php

namespace App\Http\Controllers\Admin;

use App\Models\Child;
use App\Models\Group;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends AdminController
{
    public function summary(Request $request): JsonResponse
    {
        $orgId = $this->orgId($request);

        return response()->json([
            'bolalar_soni'       => Child::forOrganization($orgId)->count(),
            'guruhlar_soni'      => Group::forOrganization($orgId)->active()->count(),
            'tarbiyachilar_soni' => TeacherProfile::forOrganization($orgId)->active()->count(),
            'ota_onalar_soni'    => ParentProfile::forOrganization($orgId)->count(),
        ]);
    }
}
