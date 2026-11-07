<?php

namespace App\Http\Requests;

use App\Models\Message;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Tarbiyachi xabari: bitta bolaning ota-onalariga yoki butun guruh ota-onalariga. */
class SendMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Ruxsat (guruh va bola) controllerda Policy orqali
    }

    public function rules(): array
    {
        return [
            'audience' => ['required', Rule::in([Message::AUDIENCE_CHILD, Message::AUDIENCE_GROUP])],
            'group_id' => ['required', 'integer'],
            'child_id' => ['nullable', 'required_if:audience,' . Message::AUDIENCE_CHILD, 'integer'],
            'subject'  => ['nullable', 'string', 'max:150'],
            'body'     => ['required', 'string', 'max:2000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'body'    => is_string($this->body) ? trim($this->body) : $this->body,
            'subject' => is_string($this->subject) ? (trim($this->subject) ?: null) : $this->subject,
        ]);
    }
}
