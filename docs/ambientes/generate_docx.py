import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>'))

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def create_docx(filename):
    doc = docx.Document()
    
    # Page setup - Margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Document Title
    p_title = doc.add_paragraph()
    r_title = p_title.add_run("KALIDASH · SOLICITAÇÃO TÉCNICA DE ACESSOS, DNS, ENVS E PRÉ-PRODUÇÃO")
    r_title.font.name = "Arial"
    r_title.font.size = Pt(16)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(17, 17, 17)
    
    p_sub = doc.add_paragraph()
    r_sub = p_sub.add_run("Guia oficial completo para apontamento de domínios (Vercel/VPS), Google Analytics 4, Ads, Workspace e E-mail")
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(10)
    r_sub.font.italic = True
    r_sub.font.color.rgb = RGBColor(100, 100, 100)

    p_div = doc.add_paragraph()
    r_div = p_div.add_run("―" * 58)
    r_div.font.color.rgb = RGBColor(200, 200, 200)

    # 1. Objetivo e Fases
    p_ctx_h = doc.add_heading(level=2)
    r_ctx_h = p_ctx_h.add_run("1. Objetivo e Faseamento de Implantação (Pré-Produção e Produção)")
    r_ctx_h.font.name = "Arial"
    r_ctx_h.font.size = Pt(13)
    r_ctx_h.font.bold = True
    r_ctx_h.font.color.rgb = RGBColor(202, 110, 70)

    p_ctx = doc.add_paragraph(
        "Este documento destina-se aos gestores de tráfego, administradores de TI e responsáveis pelas contas da Kalidash. "
        "A implantação ocorrerá em duas fases bem definidas:"
    )
    p_ctx.paragraph_format.line_spacing = 1.15

    bp1 = doc.add_paragraph(style='List Bullet')
    r1 = bp1.add_run("Fase 1 (Pré-Produção / Homologação): ")
    r1.bold = True
    r1.font.name = "Arial"
    r1.font.size = Pt(9.5)
    r2 = bp1.add_run("Publicação prévia em ambiente isolado para validação operacional e testes ponta a ponta da equipe. Nesta fase, a VPS de aplicação e o banco de dados MySQL rodam sob a infraestrutura técnica do desenvolvedor, dispensando provisionamento imediato de servidores pela Kalidash.")
    r2.font.name = "Arial"
    r2.font.size = Pt(9.5)

    bp2 = doc.add_paragraph(style='List Bullet')
    r3 = bp2.add_run("Fase 2 (Produção Oficial): ")
    r3.bold = True
    r3.font.name = "Arial"
    r3.font.size = Pt(9.5)
    r4 = bp2.add_run("Virada final para os servidores definitivos da Kalidash com apontamentos principais de DNS e credenciais de produção consolidadas.")
    r4.font.name = "Arial"
    r4.font.size = Pt(9.5)

    doc.add_paragraph()

    # 2. DNS Table
    p_s_dns = doc.add_heading(level=2)
    r_s_dns = p_s_dns.add_run("2. Apontamentos de DNS no Cloudflare (Vercel e VPS)")
    r_s_dns.font.name = "Arial"
    r_s_dns.font.size = Pt(13)
    r_s_dns.font.bold = True
    r_s_dns.font.color.rgb = RGBColor(202, 110, 70)

    doc.add_paragraph(
        "Para ativar os domínios oficiais kalidash.com (Site), app.kalidash.com (CRM) e api.kalidash.com (Backend), "
        "solicitamos a criação das seguintes entradas na zona de DNS (Cloudflare da Kalidash):"
    )

    t_dns = doc.add_table(rows=1, cols=5)
    t_dns.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr_dns = t_dns.rows[0].cells
    hdr_dns[0].text = "Tipo"
    hdr_dns[1].text = "Nome / Host"
    hdr_dns[2].text = "Destino / Valor"
    hdr_dns[3].text = "Finalidade / Serviço"
    hdr_dns[4].text = "Destino"
    for cell in hdr_dns:
        set_cell_background(cell, "F4F4F5")
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.name = "Arial"
                run.font.size = Pt(9.5)

    items_dns = [
        ("A", "@ (ou kalidash.com)", "76.76.21.21", "Site Institucional (Next.js 15)", "Vercel"),
        ("CNAME", "www", "cname.vercel-dns.com", "Redirecionamento www para apex", "Vercel"),
        ("CNAME", "app", "cname.vercel-dns.com", "Admin CRM PWA (app.kalidash.com)", "Vercel"),
        ("A", "api", "IP da VPS (fornecido pelo dev)", "API Go / Backend (api.kalidash.com) — DNS Only (cinza)", "VPS Dev")
    ]

    for tipo, host, valor, fin, dest in items_dns:
        row = t_dns.add_row().cells
        row[0].text = tipo
        row[1].text = host
        row[2].text = valor
        row[3].text = fin
        row[4].text = dest
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Arial"
                    run.font.size = Pt(9)

    doc.add_paragraph()

    # 3. Frontend IDs
    p_s2 = doc.add_heading(level=2)
    r_s2 = p_s2.add_run("3. IDs de Rastreamento do Frontend (Site Institucional)")
    r_s2.font.name = "Arial"
    r_s2.font.size = Pt(13)
    r_s2.font.bold = True
    r_s2.font.color.rgb = RGBColor(202, 110, 70)

    doc.add_paragraph(
        "Os seguintes identificadores serão incluídos no código público do site (apps/site) para carregar os scripts de coleta no navegador:"
    )

    t1 = doc.add_table(rows=1, cols=3)
    t1.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t1.rows[0].cells
    hdr[0].text = "Item Solicitado"
    hdr[1].text = "Exemplo de Formato"
    hdr[2].text = "Onde Encontrar"
    for cell in hdr:
        set_cell_background(cell, "F4F4F5")
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.name = "Arial"
                run.font.size = Pt(9.5)

    items_t1 = [
        ("Container ID do Google Tag Manager (GTM)", "GTM-XXXXXXX", "No topo direito do painel em tagmanager.google.com"),
        ("Measurement ID do Google Analytics 4 (GA4)", "G-XXXXXXXXXX", "GA4 > Administrador > Fluxos de dados > Detalhes do fluxo web"),
        ("ID do Pixel da Meta (Facebook / Instagram)", "184920492810482 (15-16 dígitos)", "Meta Business Suite > Gerenciador de Eventos > Fontes de Dados"),
        ("Google Ads - ID de Conversão e Rótulo (Lead)", "AW-XXXXXXXXXX / AbCd_EfGhIjKlMnOpQrS", "Google Ads > Metas > Conversões > Detalhes da Ação")
    ]

    for item, ex, where in items_t1:
        row = t1.add_row().cells
        row[0].text = item
        row[1].text = ex
        row[2].text = where
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Arial"
                    run.font.size = Pt(9)

    doc.add_paragraph()

    # 4. GA4 API
    p_s3 = doc.add_heading(level=2)
    r_s3 = p_s3.add_run("4. Credenciais da API do GA4 (Workspace Kalidash → Admin)")
    r_s3.font.name = "Arial"
    r_s3.font.size = Pt(13)
    r_s3.font.bold = True
    r_s3.font.color.rgb = RGBColor(202, 110, 70)

    doc.add_paragraph(
        "Para que o backend da Kalidash (apps/api em Go) consulte a Google Analytics Data API e exiba gráficos reais no Admin:"
    )

    t2 = doc.add_table(rows=1, cols=3)
    t2.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr2 = t2.rows[0].cells
    hdr2[0].text = "Item Solicitado"
    hdr2[1].text = "Formato / Descrição"
    hdr2[2].text = "Instrução de Obtenção"
    for cell in hdr2:
        set_cell_background(cell, "F4F4F5")
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.name = "Arial"
                run.font.size = Pt(9.5)

    items_t2 = [
        ("ID da Propriedade no GA4 (GA4_PROPERTY_ID)", "Ex: 429182301 (apenas números)", "GA4 > Administrador > Configurações da propriedade > Detalhes"),
        ("E-mail e Chave Privada da Service Account", "nome@projeto.iam.gserviceaccount.com / PEM", "Google Cloud Console > IAM e administração > Contas de serviço > Chaves (JSON)"),
        ("Permissão de Leitor no GA4", "Liberação no painel do GA4", "Adicionar o e-mail da Service Account em 'Gerenciamento de acesso à propriedade' como Leitor"),
        ("Segredo da API do Measurement Protocol (GA4_API_SECRET)", "String alfanumérica de API Secret", "GA4 > Fluxos de Dados > Detalhes > Segredos do Measurement Protocol")
    ]

    for item, desc, inst in items_t2:
        row = t2.add_row().cells
        row[0].text = item
        row[1].text = desc
        row[2].text = inst
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Arial"
                    run.font.size = Pt(9)

    doc.add_paragraph()

    # 5. Google Workspace SSO
    p_s4 = doc.add_heading(level=2)
    r_s4 = p_s4.add_run("5. Google Workspace SSO (OAuth 2.0 dos Colaboradores)")
    r_s4.font.name = "Arial"
    r_s4.font.size = Pt(13)
    r_s4.font.bold = True
    r_s4.font.color.rgb = RGBColor(202, 110, 70)

    doc.add_paragraph(
        "Para que colaboradores com e-mail @kalidash.com acessem o CRM via Google Workspace Single Sign-On (OAuth 2.0):"
    )

    t3 = doc.add_table(rows=1, cols=3)
    t3.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr3 = t3.rows[0].cells
    hdr3[0].text = "Item Solicitado"
    hdr3[1].text = "Configuração / Exemplo"
    hdr3[2].text = "Instrução de Obtenção"
    for cell in hdr3:
        set_cell_background(cell, "F4F4F5")
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.name = "Arial"
                run.font.size = Pt(9.5)

    items_t3 = [
        ("Client ID do OAuth 2.0 (GOOGLE_CLIENT_ID)", "xxxx.apps.googleusercontent.com", "Google Cloud Console > APIs e serviços > Credenciais > ID do cliente OAuth"),
        ("Client Secret (GOOGLE_CLIENT_SECRET)", "GOCSPX-xxxxxxxxxxxx", "Gerado junto com o Client ID no Google Cloud Console"),
        ("URIs de Redirecionamento Autorizado", "https://api.kalidash.com/auth/google/callback", "Cadastrar esta URL nas credenciais OAuth no Google Cloud Console"),
        ("Origens JavaScript Autorizadas", "https://app.kalidash.com", "Cadastrar a URL do Admin (app) nas credenciais OAuth no Google Cloud Console")
    ]

    for item, desc, inst in items_t3:
        row = t3.add_row().cells
        row[0].text = item
        row[1].text = desc
        row[2].text = inst
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Arial"
                    run.font.size = Pt(9)

    doc.add_paragraph()

    # 6. Decisão de E-mail
    p_s5 = doc.add_heading(level=2)
    r_s5 = p_s5.add_run("6. Decisão Técnica de E-mail: Resend vs. Gmail API")
    r_s5.font.name = "Arial"
    r_s5.font.size = Pt(13)
    r_s5.font.bold = True
    r_s5.font.color.rgb = RGBColor(202, 110, 70)

    doc.add_paragraph(
        "O Kalidash CRM possui capacidade de disparar e-mails para contatos de oportunidades e enviar testes de modelos visuais. "
        "Apresentamos abaixo os dois caminhos técnicos disponíveis para decisão da equipe:"
    )

    t_email = doc.add_table(rows=1, cols=3)
    t_email.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr_e = t_email.rows[0].cells
    hdr_e[0].text = "Critério de Decisão"
    hdr_e[1].text = "Opção A: Resend (Implementada / Recomendada)"
    hdr_e[2].text = "Opção B: Gmail API Direto (Google Workspace)"
    for cell in hdr_e:
        set_cell_background(cell, "F4F4F5")
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.bold = True
                run.font.name = "Arial"
                run.font.size = Pt(9.5)

    items_email = [
        ("Como Funciona", "Disparo transacional via API HTTP com domínio kalidash.com autenticado por DKIM/SPF.", "Disparo via OAuth 2.0 saindo fisicamente da caixa pessoal de cada vendedor (@kalidash.com)."),
        ("Complexidade de Setup", "Muito Baixa: Apenas 1 chave central no servidor (RESEND_API_KEY) e 3 registros DNS.", "Alta: Exige aprovação de escopo restrito no Google Workspace e gestão de tokens por usuário."),
        ("Pasta 'Itens Enviados'", "Não aparece no Gmail pessoal do vendedor (fica registrado na Timeline da Oportunidade no CRM).", "Aparece fisicamente na pasta 'Enviados' do Gmail/Outlook do colaborador."),
        ("Limites e Risco de Bloqueio", "Zero risco para as contas Google: suporta dezenas de milhares de envios com alta entregabilidade.", "Risco Médio: Limite diário de 500-2.000 envios. Se houver disparo em massa, a conta Workspace pode ser suspensa."),
        ("Status no Código Hoje", "100% implementado e testado no backend em Go (/api/emails/send e /api/emails/test).", "Não implementado: exige desenvolvimento de nova rota OAuth com refresh_token por usuário."),
        ("O que é necessário providenciar", "1. Criar conta no resend.com e gerar RESEND_API_KEY.\n2. Adicionar 3 registros DNS (DKIM/SPF) no Cloudflare de kalidash.com.", "1. Habilitar Gmail API no Google Cloud.\n2. Delegar autoridade de domínio no painel Workspace.\n3. Homologar tela de consentimento.")
    ]

    for crit, optA, optB in items_email:
        row = t_email.add_row().cells
        row[0].text = crit
        row[1].text = optA
        row[2].text = optB
        for cell in row:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.name = "Arial"
                    run.font.size = Pt(9)

    doc.add_paragraph()

    p_rec = doc.add_paragraph()
    r_rec_title = p_rec.add_run("Recomendação da Engenharia para o Go-Live: ")
    r_rec_title.bold = True
    r_rec_title.font.name = "Arial"
    r_rec_title.font.size = Pt(9.5)
    r_rec_desc = p_rec.add_run(
        "Recomendamos iniciar com a Opção A (Resend), pois já está pronta e validada no código, protege a reputação do domínio principal "
        "e permite subir a operação imediatamente apenas apontando os registros DNS. Caso no futuro a equipe comercial demande que mensagens 1 a 1 "
        "reflitam no Gmail pessoal, a Opção B pode ser implementada como uma evolução modular sem retrabalho na base."
    )
    r_rec_desc.font.name = "Arial"
    r_rec_desc.font.size = Pt(9.5)

    doc.add_paragraph()

    # 7. Campanhas (Google Ads e Meta Ads)
    p_s6 = doc.add_heading(level=2)
    r_s6 = p_s6.add_run("7. Parâmetros das Campanhas de Anúncios (Google e Meta)")
    r_s6.font.name = "Arial"
    r_s6.font.size = Pt(13)
    r_s6.font.bold = True
    r_s6.font.color.rgb = RGBColor(202, 110, 70)

    doc.add_paragraph("Aos gestores de tráfego de Google Ads e Meta Ads, solicitamos os seguintes alinhamentos operacionais:")
    
    bullets = [
        ("Meta Ads - Token da API de Conversões (CAPI):", "Token de Acesso de Sistema gerado em Configurações do Negócio > Usuários do Sistema, com permissão de gerar eventos no Pixel."),
        ("Meta Ads - Verificação de Domínio:", "Geração do código de verificação TXT DNS para aprovar kalidash.com no Gerenciador de Negócios da Meta."),
        ("Google Ads - Auto-tagging (Codificação Automática):", "Garantir que a opção de Codificação Automática (gclid) esteja ativada na conta do Google Ads."),
        ("Google Ads - Conversões Aprimoradas (Enhanced Conversions):", "Ativação de conversões aprimoradas para envio de hash SHA-256 de e-mail e telefone.")
    ]
    for b_title, b_desc in bullets:
        bp = doc.add_paragraph(style='List Bullet')
        r1 = bp.add_run(b_title + " ")
        r1.bold = True
        r1.font.name = "Arial"
        r1.font.size = Pt(9.5)
        r2 = bp.add_run(b_desc)
        r2.font.name = "Arial"
        r2.font.size = Pt(9.5)

    doc.add_paragraph()

    # 8. Entrega Segura
    p_s7 = doc.add_heading(level=2)
    r_s7 = p_s7.add_run("8. Entrega Segura das Informações")
    r_s7.font.name = "Arial"
    r_s7.font.size = Pt(13)
    r_s7.font.bold = True
    r_s7.font.color.rgb = RGBColor(202, 110, 70)

    doc.add_paragraph(
        "Por questões de segurança da informação, segredos como a Chave Privada da Service Account, o Client Secret do Google Workspace, o Token da CAPI e a API Key do Resend "
        "NÃO devem ser compartilhados por canais abertos ou mensagens sem criptografia. Recomendamos o envio do arquivo JSON da chave ou o preenchimento direto no cofre de variáveis de ambiente do servidor."
    )

    p_foot = doc.add_paragraph()
    r_foot = p_foot.add_run("Documento emitido pela Equipe de Arquitetura Kalidash · Outubro de 2026")
    r_foot.font.name = "Arial"
    r_foot.font.size = Pt(9)
    r_foot.font.italic = True
    r_foot.font.color.rgb = RGBColor(140, 140, 140)

    doc.save(filename)
    print(f"DOCX gerado com sucesso: {filename}")

if __name__ == "__main__":
    out_dir = r"d:\Códigos\Tzolkin\Projetos\Carol\Kalidash\docs\ambientes"
    docx_path = os.path.join(out_dir, "solicitacao-acessos-kalidash.docx")
    create_docx(docx_path)
