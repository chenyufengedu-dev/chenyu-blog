import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

export const runtime = "nodejs";

const contactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  message: z.string().min(10).max(3000),
});

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = contactSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: "表单内容不符合要求" },
        { status: 400 },
      );
    }

    const { name, email, message } = result.data;

    const toEmail = process.env.CONTACT_TO_EMAIL;
    const fromEmail = process.env.CONTACT_FROM_EMAIL;

    if (!toEmail || !fromEmail || !process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { message: "邮件服务尚未配置完成" },
        { status: 500 },
      );
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      replyTo: email,
      subject: `来自 Chenyu Blog 的新留言：${name}`,
      text: `姓名：${name}\n邮箱：${email}\n\n留言：\n${message}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.7; color: #111827;">
          <h2>Chenyu Blog 收到一条新留言</h2>
          <p><strong>姓名：</strong>${safeName}</p>
          <p><strong>邮箱：</strong>${safeEmail}</p>
          <p><strong>留言：</strong></p>
          <div style="padding: 16px; border-left: 3px solid #ea580c; background: #f9fafb;">
            ${safeMessage}
          </div>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ message: "邮件发送失败" }, { status: 500 });
    }

    return NextResponse.json({ message: "邮件发送成功" });
  } catch {
    return NextResponse.json({ message: "服务器处理失败" }, { status: 500 });
  }
}
