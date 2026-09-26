<?php

namespace App\Http\Controllers\Admin;

use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class TeacherController extends AdminController
{
    public function index(Request $request): JsonResponse
    {
        $teachers = TeacherProfile::forOrganization($this->orgId($request))
                                  ->with('groups:id,name')
                                  ->orderBy('last_name')
                                  ->orderBy('first_name')
                                  ->get();

        return response()->json(['data' => $teachers]);
    }

    public function store(Request $request): JsonResponse
    {
        $orgId = $this->orgId($request);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name'  => ['required', 'string', 'max:100'],
            'phone'      => ['required', 'string', 'max:20', 'unique:users,phone'],
            'password'   => ['required', 'string', 'min:6'],
            'position'   => ['nullable', 'string', 'max:100'],
        ]);

        $teacher = DB::transaction(function () use ($data, $orgId) {
            $user = User::create([
                'name'            => "{$data['first_name']} {$data['last_name']}",
                'phone'           => $data['phone'],
                'password'        => Hash::make($data['password']),
                'role'            => User::ROLE_TEACHER,
                'organization_id' => $orgId,
                'is_active'       => true,
            ]);

            return TeacherProfile::create([
                'user_id'         => $user->id,
                'organization_id' => $orgId,
                'first_name'      => $data['first_name'],
                'last_name'       => $data['last_name'],
                'phone'           => $data['phone'],
                'position'        => $data['position'] ?? 'Tarbiyachi',
                'is_active'       => true,
            ]);
        });

        return response()->json([
            'data'    => $teacher,
            'message' => "Tarbiyachi muvaffaqiyatli qo'shildi.",
        ], 201);
    }
}
