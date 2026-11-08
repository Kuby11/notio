import { describe, expect, it, vi } from 'vitest';
import { createEmailJSMailSender } from '../src/auth/mailer';

/** A fetch mock typed like the real transport: the URL and the request init. */
type FetchStub = (url: string, init?: RequestInit) => Promise<Response>;

/** A 200 response from the EmailJS API. */
function okResponse(): Response {
  return new Response('OK', { status: 200 });
}

const OPTIONS = {
  serviceId: 'service_notio',
  templateId: 'template_verify',
  publicKey: 'pub-key',
  privateKey: 'priv-key',
};

describe('createEmailJSMailSender', () => {
  it('sends the email via the EmailJS REST API: keys, template and variables', async () => {
    const fetchFn = vi.fn<FetchStub>().mockResolvedValue(okResponse());
    const sender = createEmailJSMailSender(OPTIONS, fetchFn);

    await sender.send({
      to: 'user@example.com',
      subject: 'Confirm your email for notio',
      actionUrl: 'https://notio.dev/api/auth/verify-email?token=abc',
      kind: 'VERIFY_EMAIL',
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    const call = fetchFn.mock.calls[0];

    if (call === undefined) {
      throw new Error('EmailJS was not called');
    }

    const [url, init] = call;

    expect(url).toBe('https://api.emailjs.com/api/v1.0/email/send');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body)) as {
      service_id: string;
      template_id: string;
      user_id: string;
      accessToken: string;
      template_params: Record<string, string>;
    };

    expect(body.service_id).toBe('service_notio');
    expect(body.template_id).toBe('template_verify');
    expect(body.user_id).toBe('pub-key');
    expect(body.accessToken).toBe('priv-key');
    expect(body.template_params['to_email']).toBe('user@example.com');
    expect(body.template_params['subject']).toBe('Confirm your email for notio');
    expect(body.template_params['action_url']).toContain('token=abc');
    expect(body.template_params['message']).toContain('Confirm your email address');
  });

  it('substitutes the subject by email kind when none is given', async () => {
    const fetchFn = vi.fn<FetchStub>().mockResolvedValue(okResponse());
    const sender = createEmailJSMailSender(OPTIONS, fetchFn);

    await sender.send({
      to: 'user@example.com',
      subject: '',
      actionUrl: 'https://notio.dev/reset',
      kind: 'RESET_PASSWORD',
    });

    const body = JSON.parse(String(vi.mocked(fetchFn).mock.calls[0]?.[1]?.body)) as {
      template_params: Record<string, string>;
    };

    expect(body.template_params['subject']).toBe('Reset your password for notio');
  });

  it('rejects the send when EmailJS returns an error', async () => {
    const fetchFn = vi
      .fn<FetchStub>()
      .mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const sender = createEmailJSMailSender(OPTIONS, fetchFn);

    await expect(
      sender.send({
        to: 'user@example.com',
        subject: 'Confirm your email for notio',
        actionUrl: 'https://notio.dev/verify',
        kind: 'VERIFY_EMAIL',
      }),
    ).rejects.toThrow(/401/);
  });
});
