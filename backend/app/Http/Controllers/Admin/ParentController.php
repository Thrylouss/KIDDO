<?php

namespace App\Http\Controllers\Admin;

use App\Models\ParentProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ParentController extends AdminController
{
    public function index(Request $request): JsonResponse
    {
        $parents = ParentProfile::forOrganization($this->orgId($request))
                                ->with('children:id,first_name,last_name')
                                ->orderBy('last_name')
                                ->orderBy('first_name')
                                ->get();

        return response()->json(['data' => $parents]);
    }
}
