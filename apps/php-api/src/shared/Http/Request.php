<?php

declare(strict_types=1);

namespace KeyTrialPro\shared\Http;

final class Request
{
    public function __construct(
        public readonly string $method,
        public readonly array $headers,
        public readonly array $query,
        public readonly array $body,
    ) {
    }

    public static function capture(): self
    {
        $rawBody = file_get_contents('php://input') ?: '';
        $decoded = json_decode($rawBody, true);

        return new self(
            method: $_SERVER['REQUEST_METHOD'] ?? 'GET',
            headers: function_exists('getallheaders') ? (getallheaders() ?: []) : [],
            query: $_GET,
            body: is_array($decoded) ? $decoded : $_POST,
        );
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }
}

