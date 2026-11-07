<?php

namespace App\Http\Requests;

use App\Models\Organization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChangeOrganizationStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Policy controller'da
    }

    public function rules(): array
    {
        return [
            'status'          => ['required', Rule::in(Organization::STATUSES)],
            // Faol emas / to'xtatish / arxivlash uchun sabab majburiy (audit)
            'reason'          => [Rule::requiredIf(fn () => $this->input('status') !== Organization::STATUS_ACTIVE), 'nullable', 'string', 'min:3', 'max:500'],
            'suspended_until' => ['nullable', Rule::prohibitedIf(fn () => $this->input('status') !== Organization::STATUS_SUSPENDED), 'date', 'after:now'],
        ];
    }

    public function messages(): array
    {
        return [
            'status.required'          => 'Yangi holatni tanlang.',
            'status.in'                => "Noto'g'ri holat.",
            'reason.required'          => 'Sababni kiriting.',
            'reason.min'               => 'Sabab juda qisqa.',
            'reason.max'               => 'Sabab juda uzun (500 belgigacha).',
            'suspended_until.after'    => "To'xtatish muddati kelajakdagi sana bo'lishi kerak.",
            'suspended_until.date'     => "Sana noto'g'ri.",
            'suspended_until.prohibited' => "Muddat faqat vaqtincha to'xtatishda kiritiladi.",
        ];
    }
}
