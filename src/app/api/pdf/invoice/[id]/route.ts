import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.chaiwale.co.in';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Proxy request to backend documents API
    const backendRes = await fetch(`${BACKEND_URL}/api/v1/documents/pdf/invoice/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf'
      },
      cache: 'no-store'
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text().catch(() => '');
      return NextResponse.json(
        {
          error: `Backend failed to generate PDF (HTTP ${backendRes.status})`,
          details: errText
        },
        { status: backendRes.status }
      );
    }

    const pdfBuffer = await backendRes.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Invoice-${id}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error proxying PDF', message: err.message },
      { status: 500 }
    );
  }
}
