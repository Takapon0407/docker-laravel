<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class ProfileController extends Controller
{
    public function show(Request $request): View
    {
        $key = config('profile.career_query.key');
        $value = config('profile.career_query.value');

        return view('profile', [
            'showCareer' => is_string($key) && is_string($value) && $request->query($key) === $value,
        ]);
    }
}
