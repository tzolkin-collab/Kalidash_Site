import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def create_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#111111')
    )
    sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#666666')
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#ca6e46'),
        spaceBefore=7,
        spaceAfter=3
    )
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.8,
        leading=11,
        textColor=colors.HexColor('#333333')
    )
    bullet_style = ParagraphStyle(
        'BulletItem',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor('#333333'),
        leftIndent=8,
        spaceAfter=1.5
    )
    table_header_style = ParagraphStyle(
        'TH',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#111111')
    )
    table_cell_style = ParagraphStyle(
        'TD',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.2,
        leading=9.2,
        textColor=colors.HexColor('#333333')
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("KALIDASH · SOLICITAÇÃO TÉCNICA DE ACESSOS, DNS, ENVS E PRÉ-PRODUÇÃO", title_style))
    story.append(Spacer(1, 1))
    story.append(Paragraph("Guia oficial completo para apontamento de domínios (Vercel/VPS), Google Analytics 4, Ads, Workspace e E-mail", sub_style))
    story.append(Spacer(1, 2))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#E5E7EB'), spaceBefore=2, spaceAfter=4))

    # 1. Objetivo e Fases
    story.append(Paragraph("1. Objetivo e Faseamento de Implantação (Pré-Produção e Produção)", h2_style))
    story.append(Paragraph(
        "A implantação ocorre em duas fases: na <b>Fase 1 (Pré-Produção/Homologação)</b>, o banco MySQL e a VPS rodam sob a infraestrutura técnica do desenvolvedor para validação operacional e testes ponta a ponta sem custos imediatos de servidores para a Kalidash. "
        "Na <b>Fase 2 (Produção Oficial)</b>, os dados e serviços são transferidos para a infraestrutura definitiva da Kalidash.",
        body_style
    ))
    story.append(Spacer(1, 3))

    # 2. DNS Table (Vercel e VPS)
    story.append(Paragraph("2. Apontamentos de DNS no Cloudflare (Vercel e VPS)", h2_style))
    story.append(Paragraph(
        "Para ativar os domínios oficiais <b>kalidash.com</b> (Site), <b>app.kalidash.com</b> (CRM) e <b>api.kalidash.com</b> (Backend), solicitamos a criação das entradas abaixo na zona DNS (Cloudflare da Kalidash):",
        body_style
    ))
    story.append(Spacer(1, 2))

    t_dns_data = [
        [Paragraph("Tipo", table_header_style), Paragraph("Nome / Host", table_header_style), Paragraph("Destino / Valor", table_header_style), Paragraph("Finalidade / Serviço", table_header_style), Paragraph("Destino", table_header_style)],
        [Paragraph("A", table_cell_style), Paragraph("@ (ou kalidash.com)", table_cell_style), Paragraph("76.76.21.21", table_cell_style), Paragraph("Site Institucional (Next.js 15)", table_cell_style), Paragraph("Vercel", table_cell_style)],
        [Paragraph("CNAME", table_cell_style), Paragraph("www", table_cell_style), Paragraph("cname.vercel-dns.com", table_cell_style), Paragraph("Redirecionamento www para apex", table_cell_style), Paragraph("Vercel", table_cell_style)],
        [Paragraph("CNAME", table_cell_style), Paragraph("app", table_cell_style), Paragraph("cname.vercel-dns.com", table_cell_style), Paragraph("Admin CRM PWA (app.kalidash.com)", table_cell_style), Paragraph("Vercel", table_cell_style)],
        [Paragraph("A", table_cell_style), Paragraph("api", table_cell_style), Paragraph("IP da VPS (fornecido pelo dev)", table_cell_style), Paragraph("API Go / Backend (api.kalidash.com) — DNS Only (cinza)", table_cell_style), Paragraph("VPS Dev", table_cell_style)]
    ]
    t_dns = Table(t_dns_data, colWidths=[38, 95, 125, 222, 60])
    t_dns.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F4F4F5')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 2.2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_dns)
    story.append(Spacer(1, 3))

    # 3. Frontend IDs
    story.append(Paragraph("3. IDs de Rastreamento do Frontend (Site Institucional)", h2_style))
    t1_data = [
        [Paragraph("Item Solicitado", table_header_style), Paragraph("Exemplo de Formato", table_header_style), Paragraph("Onde Encontrar", table_header_style)],
        [Paragraph("Container ID do Google Tag Manager (GTM)", table_cell_style), Paragraph("GTM-XXXXXXX", table_cell_style), Paragraph("Topo direito em tagmanager.google.com", table_cell_style)],
        [Paragraph("Measurement ID do Google Analytics 4 (GA4)", table_cell_style), Paragraph("G-XXXXXXXXXX", table_cell_style), Paragraph("GA4 > Administrador > Fluxos de dados > Detalhes", table_cell_style)],
        [Paragraph("ID do Pixel da Meta (Facebook / Instagram)", table_cell_style), Paragraph("184920492810482 (15-16 dígitos)", table_cell_style), Paragraph("Meta Business Suite > Gerenciador de Eventos", table_cell_style)],
        [Paragraph("Google Ads - ID de Conversão e Rótulo (Lead)", table_cell_style), Paragraph("AW-XXXXXXXXXX / AbCd_EfGhIjKlMnOpQrS", table_cell_style), Paragraph("Google Ads > Metas > Conversões > Detalhes da Ação", table_cell_style)]
    ]
    t1 = Table(t1_data, colWidths=[170, 150, 220])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F4F4F5')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 2.2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t1)
    story.append(Spacer(1, 3))

    # 4. GA4 API
    story.append(Paragraph("4. Credenciais da API do GA4 (Workspace Kalidash → Admin)", h2_style))
    t2_data = [
        [Paragraph("Item Solicitado", table_header_style), Paragraph("Formato / Descrição", table_header_style), Paragraph("Instrução de Obtenção", table_header_style)],
        [Paragraph("ID da Propriedade no GA4 (GA4_PROPERTY_ID)", table_cell_style), Paragraph("Ex: 429182301 (números)", table_cell_style), Paragraph("GA4 > Administrador > Detalhes da propriedade", table_cell_style)],
        [Paragraph("E-mail e Chave Privada da Service Account", table_cell_style), Paragraph("nome@projeto.iam.gserviceaccount.com / PEM", table_cell_style), Paragraph("GCP Console > IAM > Contas de serviço > Chaves (JSON)", table_cell_style)],
        [Paragraph("Permissão de Leitor no GA4", table_cell_style), Paragraph("Acesso de Leitura", table_cell_style), Paragraph("Adicionar Service Account no GA4 como Leitor", table_cell_style)],
        [Paragraph("Segredo da API (GA4_API_SECRET)", table_cell_style), Paragraph("String alfanumérica", table_cell_style), Paragraph("GA4 > Fluxos > Segredos do Measurement Protocol", table_cell_style)]
    ]
    t2 = Table(t2_data, colWidths=[170, 150, 220])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F4F4F5')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 2.2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t2)
    story.append(Spacer(1, 3))

    # 5. Google Workspace SSO
    story.append(Paragraph("5. Google Workspace SSO (OAuth 2.0 dos Colaboradores)", h2_style))
    t3_data = [
        [Paragraph("Item Solicitado", table_header_style), Paragraph("Configuração / Exemplo", table_header_style), Paragraph("Instrução", table_header_style)],
        [Paragraph("Client ID e Client Secret", table_cell_style), Paragraph("xxxx.apps.googleusercontent.com / GOCSPX-...", table_cell_style), Paragraph("GCP Console > APIs e serviços > Credenciais OAuth", table_cell_style)],
        [Paragraph("URIs de Redirecionamento Autorizado", table_cell_style), Paragraph("https://api.kalidash.com/auth/google/callback", table_cell_style), Paragraph("Cadastrar esta URL nas credenciais OAuth no GCP", table_cell_style)],
        [Paragraph("Origens JavaScript Autorizadas", table_cell_style), Paragraph("https://app.kalidash.com", table_cell_style), Paragraph("Cadastrar a URL do Admin (app) no cliente OAuth", table_cell_style)]
    ]
    t3 = Table(t3_data, colWidths=[170, 170, 200])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F4F4F5')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 2.2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.2),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t3)
    story.append(Spacer(1, 4))

    # 6. Decisão de E-mail
    story.append(Paragraph("6. Decisão Técnica de E-mail: Resend vs. Gmail API", h2_style))
    t_email_data = [
        [Paragraph("Critério", table_header_style), Paragraph("Opção A: Resend (Implementada / Recomendada)", table_header_style), Paragraph("Opção B: Gmail API Direto (Google Workspace)", table_header_style)],
        [Paragraph("Como Funciona", table_cell_style), Paragraph("Disparo transacional via API HTTP com domínio kalidash.com (DKIM/SPF).", table_cell_style), Paragraph("Disparo via OAuth 2.0 saindo da caixa pessoal de cada vendedor (@kalidash.com).", table_cell_style)],
        [Paragraph("Complexidade de Setup", table_cell_style), Paragraph("Muito Baixa: Apenas 1 chave (RESEND_API_KEY) e 3 registros DNS no Cloudflare.", table_cell_style), Paragraph("Alta: Exige escopo restrito no Google Workspace e gestão de tokens por usuário.", table_cell_style)],
        [Paragraph("Pasta 'Itens Enviados'", table_cell_style), Paragraph("Não aparece no Gmail pessoal (fica auditado na Timeline da Oportunidade no CRM).", table_cell_style), Paragraph("Aparece fisicamente na pasta 'Enviados' do Gmail/Outlook do colaborador.", table_cell_style)],
        [Paragraph("Limites e Risco", table_cell_style), Paragraph("Zero risco às contas Google: suporta milhares de envios com alta entregabilidade.", table_cell_style), Paragraph("Risco Médio: Limite rígido (500-2.000/dia). Risco de suspensão por suspeita de spam.", table_cell_style)],
        [Paragraph("Status no Código", table_cell_style), Paragraph("100% implementado e testado no backend em Go (/api/emails/send e /test).", table_cell_style), Paragraph("Não implementado: exige novo desenvolvimento de rotas OAuth e refresh_token.", table_cell_style)],
        [Paragraph("O que providenciar", table_cell_style), Paragraph("1. Criar conta no resend.com e gerar chave.\n2. Adicionar 3 registros DNS no Cloudflare.", table_cell_style), Paragraph("1. Habilitar Gmail API no GCP.\n2. Delegar autoridade no Workspace.\n3. Homologar tela OAuth.", table_cell_style)]
    ]
    t_email = Table(t_email_data, colWidths=[90, 225, 225])
    t_email.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F4F4F5')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_email)
    story.append(Spacer(1, 2))
    story.append(Paragraph(
        "<b>Recomendação da Engenharia:</b> Iniciar com <b>Resend</b> no Go-Live por já estar 100% pronto e blindar as contas do Google Workspace. A Gmail API pode ser adotada na Fase 2 para mensagens 1 a 1 específicas caso a equipe comercial demande.",
        body_style
    ))
    story.append(Spacer(1, 3))

    # 7. Mídia
    story.append(Paragraph("7. Parâmetros das Campanhas de Anúncios (Google e Meta)", h2_style))
    story.append(Paragraph("• <b>Meta Ads - Token CAPI & Verificação:</b> Token de Sistema no Gerenciador de Negócios e TXT DNS para homologar kalidash.com.", bullet_style))
    story.append(Paragraph("• <b>Google Ads - Auto-tagging & Conversões Aprimoradas:</b> Ativação do parâmetro <code>gclid</code> e envio de hash SHA-256.", bullet_style))
    story.append(Spacer(1, 3))

    # 8. Segurança
    story.append(Paragraph("8. Entrega Segura das Informações", h2_style))
    story.append(Paragraph(
        "Segredos como Chave Privada RSA, Client Secret, Token CAPI e Chave Resend <b>NÃO</b> devem ser compartilhados por canais abertos sem criptografia. "
        "Recomendamos o envio do arquivo JSON da chave ou inserção direta no cofre de variáveis de ambiente do servidor.",
        body_style
    ))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E5E7EB'), spaceBefore=2, spaceAfter=3))
    story.append(Paragraph("Documento emitido pela Equipe de Arquitetura Kalidash · Outubro de 2026", sub_style))

    doc.build(story)
    print(f"PDF gerado com sucesso: {filename}")

if __name__ == "__main__":
    out_dir = r"d:\Códigos\Tzolkin\Projetos\Carol\Kalidash\docs\ambientes"
    pdf_path = os.path.join(out_dir, "solicitacao-acessos-kalidash.pdf")
    create_pdf(pdf_path)
