import os
import sys
import docx
from docx.shared import Mm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import qn, nsdecls

def create_serial_document(total_count=120):
    doc = docx.Document()
    
    # ----------------------------------------------------
    # 一、 頁面與全域字型設定
    # ----------------------------------------------------
    # 1. 紙張大小：A4 直向（寬 210 mm、高 297 mm）
    section = doc.sections[0]
    section.page_width = Mm(210)
    section.page_height = Mm(297)
    
    # 2. 頁邊距（Margins）：上 7 mm、下 7 mm、左 12 mm、右 12 mm
    section.top_margin = Mm(7)
    section.bottom_margin = Mm(7)
    section.left_margin = Mm(12)
    section.right_margin = Mm(12)
    
    # 3. 字型設定：全文件採用「微軟正黑體（Microsoft JhengHei）」
    # 4. 段落與行距：行距固定為 1.1 倍，段前間距 0 pt、段後間距 2 pt
    normal_style = doc.styles['Normal']
    normal_font = normal_style.font
    normal_font.name = 'Microsoft JhengHei'
    normal_font.size = Pt(9.5)
    normal_font.color.rgb = RGBColor(0, 0, 0)
    
    rPr = normal_style.element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), 'Microsoft JhengHei')
    rFonts.set(qn('w:hAnsi'), 'Microsoft JhengHei')
    rFonts.set(qn('w:eastAsia'), 'Microsoft JhengHei')
    rFonts.set(qn('w:cs'), 'Microsoft JhengHei')
    
    pPr = normal_style.element.get_or_add_pPr()
    spPr = parse_xml(f'<w:spacing {nsdecls("w")} w:before="0" w:after="40" w:line="264" w:lineRule="auto"/>')
    pPr.append(spPr)
    
    def set_font_run(run, font_name="Microsoft JhengHei", size_pt=9.5, bold=False, color_hex="000000"):
        run.bold = bold
        run.font.size = Pt(size_pt)
        if color_hex:
            r = int(color_hex[0:2], 16)
            g = int(color_hex[2:4], 16)
            b = int(color_hex[4:6], 16)
            run.font.color.rgb = RGBColor(r, g, b)
        rpr = run._r.get_or_add_rPr()
        rf = rpr.find(qn('w:rFonts'))
        if rf is None:
            rf = OxmlElement('w:rFonts')
            rpr.append(rf)
        rf.set(qn('w:ascii'), font_name)
        rf.set(qn('w:hAnsi'), font_name)
        rf.set(qn('w:eastAsia'), font_name)
        rf.set(qn('w:cs'), font_name)

    def set_paragraph_spacing(p, before_pt=0, after_pt=2, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT):
        p.alignment = align
        p.paragraph_format.space_before = Pt(before_pt)
        p.paragraph_format.space_after = Pt(after_pt)
        p.paragraph_format.line_spacing = line_spacing

    def build_receipt_table(table, serial_no):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        tblPr = table._tbl.tblPr
        
        # 1. 表格總寬度：100% (186 mm = 10545 dxa)
        old_tblW = tblPr.find(qn('w:tblW'))
        if old_tblW is not None:
            tblPr.remove(old_tblW)
        tblPr.append(parse_xml(f'<w:tblW {nsdecls("w")} w:w="10545" w:type="dxa"/>'))
        
        # 固定版面（防止 AutoFit 壓縮欄寬）
        old_layout = tblPr.find(qn('w:tblLayout'))
        if old_layout is not None:
            tblPr.remove(old_layout)
        tblPr.append(parse_xml(f'<w:tblLayout {nsdecls("w")} w:type="fixed"/>'))
        
        # 2. 儲存格內距（Cell Padding）：上下各 3 pt (60 dxa)、左右各 6 pt (120 dxa)
        tblCellMar = parse_xml(f'''
            <w:tblCellMar {nsdecls("w")}>
                <w:top w:w="60" w:type="dxa"/>
                <w:left w:w="120" w:type="dxa"/>
                <w:bottom w:w="60" w:type="dxa"/>
                <w:right w:w="120" w:type="dxa"/>
            </w:tblCellMar>
        ''')
        tblPr.append(tblCellMar)
        
        # 3. 框線樣式：
        # 外框與標題列下框線為 0.75 pt (sz="6") 黑色實線
        # 左右兩欄中間垂直分隔線設為 0.75 pt (sz="6") 灰色虛線 (color="888888", val="dashed")
        tblBorders = parse_xml(f'''
            <w:tblBorders {nsdecls("w")}>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>
                <w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>
                <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
                <w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>
                <w:insideH w:val="single" w:sz="6" w:space="0" w:color="000000"/>
                <w:insideV w:val="dashed" w:sz="6" w:space="0" w:color="888888"/>
            </w:tblBorders>
        ''')
        tblPr.append(tblBorders)
        
        # 4. 欄位寬度比例：左欄佔 32% (3374 dxa，約 59.5 mm)，右欄佔 68% (7171 dxa，約 126.5 mm)
        col_widths = [3374, 7171]
        
        # 清除並重設 tblGrid
        old_tblGrid = table._tbl.find(qn('w:tblGrid'))
        if old_tblGrid is not None:
            table._tbl.remove(old_tblGrid)
        new_tblGrid = parse_xml(f'''
            <w:tblGrid {nsdecls("w")}>
                <w:gridCol w:w="{col_widths[0]}"/>
                <w:gridCol w:w="{col_widths[1]}"/>
            </w:tblGrid>
        ''')
        table._tbl.insert(table._tbl.index(tblPr) + 1, new_tblGrid)
        
        for row in table.rows:
            trPr = row._tr.get_or_add_trPr()
            trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
            for i, cell in enumerate(row.cells):
                tcPr = cell._tc.get_or_add_tcPr()
                old_tcW = tcPr.find(qn('w:tcW'))
                if old_tcW is not None:
                    tcPr.remove(old_tcW)
                tcPr.append(parse_xml(f'<w:tcW {nsdecls("w")} w:w="{col_widths[i]}" w:type="dxa"/>'))
                
        # ----------------------------------------------------
        # 第 1 列（標題列，背景填滿淺灰底色 #F2F2F2，字級 10.5 pt 粗體，置中對齊）
        # ----------------------------------------------------
        row0 = table.rows[0]
        for cell in row0.cells:
            tcPr = cell._tc.get_or_add_tcPr()
            tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="F2F2F2"/>'))
            tcPr.append(parse_xml(f'<w:vAlign {nsdecls("w")} w:val="center"/>'))
            
        # 左欄標題：【存根聯】（主辦方留存）
        p0_0 = row0.cells[0].paragraphs[0]
        set_paragraph_spacing(p0_0, before_pt=2, after_pt=2, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.CENTER)
        r = p0_0.add_run("【存根聯】（主辦方留存）")
        set_font_run(r, size_pt=10.5, bold=True)
        
        # 右欄標題：【收執聯】DevFest Kaohsiung 2026 活動費用分攤證明單
        p0_1 = row0.cells[1].paragraphs[0]
        set_paragraph_spacing(p0_1, before_pt=2, after_pt=2, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.CENTER)
        r = p0_1.add_run("【收執聯】DevFest Kaohsiung 2026 活動費用分攤證明單")
        set_font_run(r, size_pt=10.5, bold=True)
        
        # ----------------------------------------------------
        # 第 2 列左欄內容（存根聯，字級 9 pt，靠左對齊）
        # ----------------------------------------------------
        cell1_0 = table.rows[1].cells[0]
        p_first = cell1_0.paragraphs[0]
        set_paragraph_spacing(p_first, before_pt=0, after_pt=2, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        r1 = p_first.add_run("單據編號：")
        set_font_run(r1, size_pt=9.0, bold=True)
        r2 = p_first.add_run(f"No. {serial_no}")
        set_font_run(r2, size_pt=9.0, bold=True) # 單據編號與編號文字皆為粗體
        
        left_items = [
            ("開立日期：", "2026/11/14", 0, 2),
            ("付款人／單位抬頭：", None, 2, 0),
            ("_" * 28, None, 4, 2), # 抬頭填寫底線
            ("活動名稱：", "DevFest Kaohsiung 2026", 2, 2),
            ("收款事由：", "場地與活動成本分攤款（代收代付）", 0, 2),
            ("實收金額：", "新臺幣肆佰元整（$400）", 0, 2),
            ("收款經手人簽名：", None, 3, 0),
            ("_" * 28, None, 14, 4)  # 簽名底線
        ]
        
        for item in left_items:
            label, val, bp, ap = item
            p = cell1_0.add_paragraph()
            set_paragraph_spacing(p, before_pt=bp, after_pt=ap, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
            if label == "":
                r = p.add_run(" ")
                set_font_run(r, size_pt=9.0)
            elif val is None:
                r = p.add_run(label)
                set_font_run(r, size_pt=9.0, bold=(label == "收款經手人簽名：" or label == "付款人／單位抬頭："))
            else:
                r1 = p.add_run(label)
                set_font_run(r1, size_pt=9.0, bold=True)
                r2 = p.add_run(val)
                set_font_run(r2, size_pt=9.0, bold=(label == "實收金額："))

        # ----------------------------------------------------
        # 第 2 列右欄內容（收執聯，主欄位字級 9.5 pt，備註說明字級 8 pt）
        # ----------------------------------------------------
        cell1_1 = table.rows[1].cells[1]
        p_r_first = cell1_1.paragraphs[0]
        set_paragraph_spacing(p_r_first, before_pt=0, after_pt=2, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        r = p_r_first.add_run("單據編號：")
        set_font_run(r, size_pt=9.5, bold=True)
        r = p_r_first.add_run(f"No. {serial_no}        ")
        set_font_run(r, size_pt=9.5, bold=True)
        r = p_r_first.add_run("開立日期：")
        set_font_run(r, size_pt=9.5, bold=True)
        r = p_r_first.add_run("2026/11/14")
        set_font_run(r, size_pt=9.5, bold=False)

        # 付款人／單位抬頭（標籤與底線換行，上方加大手寫間距，長度平鋪右欄）
        p_payer_label = cell1_1.add_paragraph()
        set_paragraph_spacing(p_payer_label, before_pt=2, after_pt=0, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        r = p_payer_label.add_run("付款人／單位抬頭：")
        set_font_run(r, size_pt=9.5, bold=True)

        p_payer_line = cell1_1.add_paragraph()
        set_paragraph_spacing(p_payer_line, before_pt=4, after_pt=2, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        r = p_payer_line.add_run("_" * 68)
        set_font_run(r, size_pt=9.5, bold=False)

        right_main_items = [
            [("活動名稱：", True), ("DevFest Kaohsiung 2026", False)],
            [("收款事由：", True), ("活動場地租金與行政成本分攤款（代收代付性質）", False)],
            [("實收金額：", True), ("新臺幣肆佰元整（$400）", True)],
        ]
        for item in right_main_items:
            p = cell1_1.add_paragraph()
            set_paragraph_spacing(p, before_pt=0, after_pt=2, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
            for text, bold in item:
                r = p.add_run(text)
                set_font_run(r, size_pt=9.5, bold=bold)
                
        # 備註與法規說明（字級 8 pt）：
        p_notes_title = cell1_1.add_paragraph()
        set_paragraph_spacing(p_notes_title, before_pt=1, after_pt=1, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        r = p_notes_title.add_run("備註與法規說明：")
        set_font_run(r, size_pt=8.0, bold=True)
        
        notes = [
            "1. 本活動由非營利技術社群志工自發籌辦，採成本分攤制，全數實報實銷支應場地與活動支出。",
            "2. 主辦團隊非立案法人或營業人，無統一編號，無法開立統一發票或免用統一發票收據。",
            "3. 本筆款項屬參與者共同分攤場地與活動成本之代收代付分攤款，非個人勞務報酬或營利所得，不提供個人身分證字號申報扣繳憑單。"
        ]
        for note in notes:
            p = cell1_1.add_paragraph()
            set_paragraph_spacing(p, before_pt=0, after_pt=1, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
            r = p.add_run(note)
            set_font_run(r, size_pt=8.0, bold=False)

        # 聯絡信箱（字級 9.5 pt）
        p_email = cell1_1.add_paragraph()
        set_paragraph_spacing(p_email, before_pt=1, after_pt=2, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        r = p_email.add_run("聯絡信箱：")
        set_font_run(r, size_pt=9.5, bold=True)
        r = p_email.add_run("gdgkaohsiung@gmail.com")
        set_font_run(r, size_pt=9.5, bold=False)

        # 收款經手人（簽名）（字級 9.5 pt）
        # 標題與底線獨立分行，並在文字與底線間提供 14 pt 的充足簽名高度，下方留 4 pt 避開印章邊框
        p_sign_label = cell1_1.add_paragraph()
        set_paragraph_spacing(p_sign_label, before_pt=2, after_pt=0, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        r = p_sign_label.add_run("收款經手人（簽名）：")
        set_font_run(r, size_pt=9.5, bold=True)

        p_sign_line = cell1_1.add_paragraph()
        set_paragraph_spacing(p_sign_line, before_pt=14, after_pt=4, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.LEFT)
        r = p_sign_line.add_run("_" * 68)
        set_font_run(r, size_pt=9.5, bold=False)

        # ----------------------------------------------------
        # 4. 右欄底部內嵌印章與印花稅票表格（1 列 2 欄內嵌表格）
        # 寬度 100% (6931 dxa)，高度固定為 24 mm (1361 dxa)
        # 外框與內框均為 0.5 pt 灰色虛線，字級 8 pt，深灰 #555555
        # ----------------------------------------------------
        nested_table = cell1_1.add_table(rows=1, cols=2)
        nested_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        nt_tblPr = nested_table._tbl.tblPr
        
        old_nt_tblW = nt_tblPr.find(qn('w:tblW'))
        if old_nt_tblW is not None:
            nt_tblPr.remove(old_nt_tblW)
        nt_tblPr.append(parse_xml(f'<w:tblW {nsdecls("w")} w:w="6931" w:type="dxa"/>'))
        nt_tblPr.append(parse_xml(f'<w:tblLayout {nsdecls("w")} w:type="fixed"/>'))
        
        # 內距：上下各 2 pt (40 dxa)，左右各 4 pt (80 dxa)
        nt_tblPr.append(parse_xml(f'''
            <w:tblCellMar {nsdecls("w")}>
                <w:top w:w="40" w:type="dxa"/>
                <w:left w:w="80" w:type="dxa"/>
                <w:bottom w:w="40" w:type="dxa"/>
                <w:right w:w="80" w:type="dxa"/>
            </w:tblCellMar>
        '''))
        
        # 框線：外框與內框均為 0.5 pt (sz="4") 灰色虛線
        nt_tblPr.append(parse_xml(f'''
            <w:tblBorders {nsdecls("w")}>
                <w:top w:val="dashed" w:sz="4" w:space="0" w:color="888888"/>
                <w:left w:val="dashed" w:sz="4" w:space="0" w:color="888888"/>
                <w:bottom w:val="dashed" w:sz="4" w:space="0" w:color="888888"/>
                <w:right w:val="dashed" w:sz="4" w:space="0" w:color="888888"/>
                <w:insideH w:val="dashed" w:sz="4" w:space="0" w:color="888888"/>
                <w:insideV w:val="dashed" w:sz="4" w:space="0" w:color="888888"/>
            </w:tblBorders>
        '''))
        
        # 內嵌表格欄寬與高度
        nt_col_widths = [3465, 3466]
        old_nt_grid = nested_table._tbl.find(qn('w:tblGrid'))
        if old_nt_grid is not None:
            nested_table._tbl.remove(old_nt_grid)
        new_nt_grid = parse_xml(f'''
            <w:tblGrid {nsdecls("w")}>
                <w:gridCol w:w="{nt_col_widths[0]}"/>
                <w:gridCol w:w="{nt_col_widths[1]}"/>
            </w:tblGrid>
        ''')
        nested_table._tbl.insert(nested_table._tbl.index(nt_tblPr) + 1, new_nt_grid)
        
        nt_row = nested_table.rows[0]
        nt_trPr = nt_row._tr.get_or_add_trPr()
        # 固定高度 22 mm = 1247 dxa
        nt_trPr.append(parse_xml(f'<w:trHeight {nsdecls("w")} w:val="1247" w:hRule="exact"/>'))
        
        for i, c in enumerate(nt_row.cells):
            tcPr = c._tc.get_or_add_tcPr()
            old_c_w = tcPr.find(qn('w:tcW'))
            if old_c_w is not None:
                tcPr.remove(old_c_w)
            tcPr.append(parse_xml(f'<w:tcW {nsdecls("w")} w:w="{nt_col_widths[i]}" w:type="dxa"/>'))
            tcPr.append(parse_xml(f'<w:vAlign {nsdecls("w")} w:val="center"/>'))

        # 左格內容：
        # 【活動證明章蓋印處】
        # （請蓋：GDG Kaohsiung 活動證明章）
        left_cell = nt_row.cells[0]
        p_lc1 = left_cell.paragraphs[0]
        set_paragraph_spacing(p_lc1, before_pt=0, after_pt=1, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.CENTER)
        r = p_lc1.add_run("【活動證明章蓋印處】")
        set_font_run(r, size_pt=8.0, bold=True, color_hex="555555")
        
        p_lc2 = left_cell.add_paragraph()
        set_paragraph_spacing(p_lc2, before_pt=0, after_pt=0, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.CENTER)
        r = p_lc2.add_run("（請蓋：GDG Kaohsiung 活動證明章）")
        set_font_run(r, size_pt=8.0, bold=False, color_hex="555555")

        # 右格內容：
        # 【印花稅票黏貼與銷花處】
        # （貼 NT$1 印花稅票，並將活動證明章蓋於稅票與紙面交界處銷花）
        right_cell = nt_row.cells[1]
        p_rc1 = right_cell.paragraphs[0]
        set_paragraph_spacing(p_rc1, before_pt=0, after_pt=1, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.CENTER)
        r = p_rc1.add_run("【印花稅票黏貼與銷花處】")
        set_font_run(r, size_pt=8.0, bold=True, color_hex="555555")
        
        p_rc2 = right_cell.add_paragraph()
        set_paragraph_spacing(p_rc2, before_pt=0, after_pt=0, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.CENTER)
        r = p_rc2.add_run("（貼 NT$1 印花稅票，並將活動證明章蓋於稅票與紙面交界處銷花）")
        set_font_run(r, size_pt=8.0, bold=False, color_hex="555555")

    # ====================================================
    # 二、 迴圈產生證明單（預設 60 頁、120 份：DFK2026-001 ~ DFK2026-120）
    # ====================================================
    total_pages = (total_count + 1) // 2
    for page_idx in range(1, total_pages + 1):
        odd_num = (page_idx - 1) * 2 + 1
        even_num = odd_num + 1
        serial_top = f"DFK2026-{odd_num:03d}"
        serial_bottom = f"DFK2026-{even_num:03d}"
        
        # 1. 【上方證明單表格】
        t_top = doc.add_table(rows=2, cols=2)
        build_receipt_table(t_top, serial_top)
        
        # 2. 【水平裁切線段落】
        p_cut = doc.add_paragraph()
        set_paragraph_spacing(p_cut, before_pt=3, after_pt=3, line_spacing=1.1, align=WD_ALIGN_PARAGRAPH.CENTER)
        r_cut = p_cut.add_run("✂ ---------------------------------------- 裁 切 線 ---------------------------------------- ✂")
        set_font_run(r_cut, size_pt=9.0, bold=False, color_hex="666666")
        
        # 3. 【下方證明單表格】
        t_bottom = doc.add_table(rows=2, cols=2)
        build_receipt_table(t_bottom, serial_bottom)
        
        # 4. 除最後一頁外，插入分頁符號
        if page_idx < total_pages:
            p_break = doc.add_paragraph()
            # 將分頁段落設為極小，避免在表格與分頁符號間產生不必要的空白高度
            p_break.paragraph_format.space_before = Pt(0)
            p_break.paragraph_format.space_after = Pt(0)
            p_break.paragraph_format.line_spacing = Pt(1)
            pPr_break = p_break._p.get_or_add_pPr()
            spPr_break = parse_xml(f'<w:spacing {nsdecls("w")} w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>')
            pPr_break.append(spPr_break)
            
            run_break = p_break.add_run()
            run_break.font.size = Pt(1)
            rPr_b = run_break._r.get_or_add_rPr()
            rPr_b.append(parse_xml(f'<w:sz {nsdecls("w")} w:val="2"/>'))
            rPr_b.append(parse_xml(f'<w:szCs {nsdecls("w")} w:val="2"/>'))
            run_break.add_break(docx.enum.text.WD_BREAK.PAGE)

    # 在最末尾加入極小高度（1 pt）段落，防止 Word 在最後一個表格後自動插入預設高度段落導致第 61 頁空白頁溢出
    p_end = doc.add_paragraph()
    p_end.paragraph_format.space_before = Pt(0)
    p_end.paragraph_format.space_after = Pt(0)
    p_end.paragraph_format.line_spacing = Pt(1)
    pPr_end = p_end._p.get_or_add_pPr()
    spPr_end = parse_xml(f'<w:spacing {nsdecls("w")} w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>')
    pPr_end.append(spPr_end)
    r_end = p_end.add_run()
    r_end.font.size = Pt(1)
    rPr_end = r_end._r.get_or_add_rPr()
    rPr_end.append(parse_xml(f'<w:sz {nsdecls("w")} w:val="2"/>'))
    rPr_end.append(parse_xml(f'<w:szCs {nsdecls("w")} w:val="2"/>'))

    # 清理所有空段落以防任何頁面溢出
    for p in doc.paragraphs:
        if len(p.text.strip()) == 0 and not any(child.tag.endswith('br') for child in p._p.iter()):
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = Pt(1)
            pPr_p = p._p.get_or_add_pPr()
            spPr_p = parse_xml(f'<w:spacing {nsdecls("w")} w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>')
            pPr_p.append(spPr_p)
            for r in p.runs:
                r.font.size = Pt(1)
                
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(base_dir, "DevFest_Kaohsiung_2026_活動費用分攤證明單_含流水號.docx")
    doc.save(output_path)
    print(f"Saved: {output_path} (共 {total_pages} 頁，{total_count} 份證明單，編號至 DFK2026-{total_count:03d})")

if __name__ == "__main__":
    count = 120
    if len(sys.argv) > 1:
        try:
            count = int(sys.argv[1])
        except ValueError:
            pass
    create_serial_document(total_count=count)
