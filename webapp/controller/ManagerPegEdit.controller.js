sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
   "sap/ui/core/UIComponent"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, UIComponent) {
  "use strict";

  return Controller.extend("fbtool.controller.ManagerPegEdit", {

    /* lista de mapari intre crit din backend si ce am in modelul UI*/

    _UI_CRITS: [
      { id: "001", gradeKey: "EXPERTISE", commentKey: "EXPERTISE_TXT" },
      { id: "002", gradeKey: "NETWORK",   commentKey: "NETWORK_TXT"   },
      { id: "003", gradeKey: "TEAMING",   commentKey: "TEAMING_TXT"   },
      { id: "004", gradeKey: "PASSION",   commentKey: "PASSION_TXT"   },
      { id: "005", gradeKey: "AUTONOMY",  commentKey: "AUTONOMY_TXT"  }
    ],

    //aici stochez criteriile prima data cand le citesc din OData
    _critCache: null,

    /* aici practic am scheletul inainte sa selectez ceva */

    _getInitialPegData: function () {
      return {
        PEG_REQ_NR: "",
        PEG_ID: "",
        EXPERTISE: -1,  EXPERTISE_TXT: "",
        NETWORK:   -1,  NETWORK_TXT:   "",
        TEAMING:   -1,  TEAMING_TXT:   "",
        PASSION:   -1,  PASSION_TXT:   "",
        AUTONOMY:  -1,  AUTONOMY_TXT:  ""
      };
    },

    //curata tot formularul dupa salvare
    _resetForm: function () {
      const m = this.getView().getModel("peg");
      m.setData(this._getInitialPegData());
      m.refresh(true);

      const oModel = this.getOwnerComponent().getModel();
      if (oModel && oModel.resetChanges) { oModel.resetChanges(); }

      const inp = this.byId("pegReqInput");
      if (inp) { setTimeout(() => inp.focus(), 0); }
    },

    //imi intoarce doar anul
    _formatYear: function (v) {
      const d = (v instanceof Date) ? v : new Date(v);
      return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { year: "numeric" });
    },

    /* ca sa gasesc primul record potrivit unui set de filtre */

    _readFirst: function (path, aFilters, sSelect) {
      const oModel = this.getOwnerComponent().getModel();
      return new Promise((resolve, reject) => {
        oModel.read(path, {
          filters: aFilters || [],
          urlParameters: sSelect ? { $select: sSelect } : undefined,
          success: (d) => resolve(d && d.results && d.results[0]),
          error: reject
        });
      });
    },

    //  La încarcarea criteriilor, salveaza in cache toate variantele cheie
_loadCriteria: function () {
  if (this._critCache) { return Promise.resolve(this._critCache); }
  const oModel = this.getOwnerComponent().getModel();
  return new Promise((resolve, reject) => {
    oModel.read("/Crit_PEGSet", {
      urlParameters: { $select: "CRIT_ID,CRIT_NAME,CRIT_DESC,WEIGHT", $orderby: "CRIT_ID" },
      success: (oData) => {
        const map = {};
        (oData.results || []).forEach(r => {
          const raw = (r.CRIT_ID || "").toString().trim();           // "1" / "01" / "001"
          const id3 = raw.padStart(3, "0");                           // "001"
          const id2 = raw.padStart(2, "0");                           // "01"
          const id1 = String(Number(raw) || 0);                       // "1"
          const val = {
            CRIT_NAME: (r.CRIT_NAME || "").toString().trim(),
            CRIT_DESC: (r.CRIT_DESC || "").toString().trim(),
            WEIGHT:    Number(r.WEIGHT)
          };
          map[id3] = val; map[id2] = val; map[id1] = val;
        });
        this._critCache = map;
        resolve(map);
      },
      error: reject
    });
  });
},


    /* seteaza starea initiala a formularului */

    onInit: function () {
      this.getView().setModel(new JSONModel(this._getInitialPegData()), "peg");
    },

    /* completeaza automat PEG_ID dupa ce am scris PEG_REQ_NR, ca sa pot salva notele corect legate de cerere. */

    onReqChange: function () {
      const oModel = this.getOwnerComponent().getModel();
      const oPeg   = this.getView().getModel("peg");
      const sReq   = oPeg.getProperty("/PEG_REQ_NR");
      if (!sReq) { return; }

      this.getView().setBusy(true);
      oModel.read("/Peg_RequestSet", {
        filters: [ new Filter("PEG_REQ_NR", FilterOperator.EQ, sReq) ],
        success: (oData) => {
          const a = oData && oData.results || [];
          if (!a.length) {
            this.getView().setBusy(false);
            MessageBox.warning("PEG request not found.");
            return;
          }
          oPeg.setProperty("/PEG_ID", a[0].PEG_ID);
          this.getView().setBusy(false);
        },
        error: () => {
          this.getView().setBusy(false);
          MessageBox.error("Error while reading the PEG request.");
        }
      });
    },





    /* creeaza notele, le salveaza si marcheaza in tabela de grades statusul ca fiind SENT */

    onSave: function () {
      const oView  = this.getView();
      const oModel = this.getOwnerComponent().getModel();
      const p      = oView.getModel("peg").getData();

      if (!p.PEG_REQ_NR)  { MessageToast.show("Please enter the PEG request number."); return; }
      if (!p.PEG_ID)      { MessageToast.show("PEG_ID not found for this request.");   return; }

      const allPicked = [p.EXPERTISE, p.NETWORK, p.TEAMING, p.PASSION, p.AUTONOMY].every(v => (v|0) >= 0);
      if (!allPicked) { MessageToast.show("Please select a grade for all criteria before saving."); return; }

      const mk = (crit, idx, txt) => ({
        PEG_ID:        p.PEG_ID,
        CRIT_ID:       crit,
        GRADE:         (idx|0) + 1,
        GRADE_COMMENT: txt || "",
        STATUS:        "SENT",
        REVIEW_DATE:   new Date()
      });

      const payloads = this._UI_CRITS.map(c => mk(c.id, p[c.gradeKey], p[c.commentKey]));

      oView.setBusy(true);
      const createOne = (i) => {
        if (i >= payloads.length) { return this._markReqDone(p.PEG_REQ_NR, p.PEG_ID); }
        oModel.create("/Peg_GradesSet", payloads[i], {
          success: () => createOne(i + 1),
          error:   () => { oView.setBusy(false); MessageBox.error("Error while saving grades."); }
        });
      };
      createOne(0);
    },

    //schimba statusul de la peg req din pending in done
    _markReqDone: function (sReqNr, sPegId) {
      const oView  = this.getView();
      const oModel = this.getOwnerComponent().getModel();
      const sKey   = oModel.createKey("/Peg_RequestSet", { PEG_REQ_NR: sReqNr, PEG_ID: sPegId });

      oModel.update(sKey, { STATUS: "DONE" }, {
        success: () => { oView.setBusy(false); MessageToast.show("Grades saved successfully. PEG request completed."); this._resetForm(); },
        error:   () => { oView.setBusy(false); MessageToast.show("Grades saved, but the request status could not be updated."); }
      });
    },

    /* Excel export (incarca dinamic ExcelJS daca nu e deja in memorie)  */

    _loadExcelJS: function () {
  return new Promise((resolve, reject) => {
    if (window.ExcelJS) { 
      resolve(window.ExcelJS); 
      return; 
    }

    const url = sap.ui.require.toUrl("fbtool/thirdparty/exceljs.min.js");

    const s = document.createElement("script");
    s.src = url;
    s.onload = () => window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error("ExcelJS not loaded"));
    s.onerror = () => reject(new Error("Failed to load ExcelJS from " + url));
    document.head.appendChild(s);
  });
},


    onExport: function () { return this.onExportAdvanced(); },

    onExportAdvanced: async function () {
      const oModel = this.getOwnerComponent().getModel();
      const peg    = this.getView().getModel("peg").getData();

      if (!peg.PEG_REQ_NR) {
        MessageToast.show("Please enter the PEG request number first.");
        return;
      }

      try {
        this.getView().setBusy(true);

        // PEG request 
        const req = await this._readFirst(
          "/Peg_RequestSet",
          [ new Filter("PEG_REQ_NR", FilterOperator.EQ, peg.PEG_REQ_NR) ],
          "PEG_ID,PEG_REQ_NR,USER_ID,MANAGER_ID,PROJ_ID,REQUEST_DATE"
        );
        if (!req) { this.getView().setBusy(false); MessageBox.warning("PEG request was not found."); return; }

        // User
        const emp = await this._readFirst("/UserSet", [ new Filter("USER_ID", FilterOperator.EQ, req.USER_ID) ]);

        //  Manager
        const mgr = await this._readFirst("/UserSet",
          [ new Filter("USER_ID", FilterOperator.EQ, req.MANAGER_ID) ],
          "USER_ID,NAME"
        );

        //  Criteria
        const critMap = await this._loadCriteria();

        // proiect dupa PROJ_ID -> o sa am PROJ_NR + PROJ_NAME
        let projectLine = "";
        if (req.PROJ_ID) {
          try {
            const prj = await this._readFirst(
              "/ProjectsSet",
              [ new Filter("PROJ_ID", FilterOperator.EQ, req.PROJ_ID) ],
              "PROJ_ID,PROJ_NR,PROJ_NAME"
            );
            if (prj) { projectLine = [prj.PROJ_NR, prj.PROJ_NAME].filter(Boolean).join(" - "); }
          } catch (_e) { }
        }

        // Randurile mele: (Criterion / Description / Grade / Weight / Comments) 
        const toGrade = (i) => (i|0) >= 0 ? (i|0) + 1 : null;

        let sumWeighted = 0, sumW = 0;
        const rowsData = this._UI_CRITS.map(c => {
          const id3    = String(c.id).padStart(3, "0");      // "001"...
          const srv    = critMap[id3] || {};
          const grade   = toGrade(peg[c.gradeKey]);
          const comment = peg[c.commentKey] || "";
          let weight    = srv.WEIGHT;

          
          const wFrac   = (weight != null) ? (Number(weight) > 1 ? Number(weight)/100 : Number(weight)) : 0;
          if (grade != null && wFrac > 0) {
            sumWeighted += grade * wFrac;
            sumW        += wFrac;
          }
          const weightPctStr = (weight != null)
            ? (Number(weight) > 1 ? Number(weight).toFixed(1) + "%" : (Number(weight * 100).toFixed(1) + "%"))
            : "";

          return {
            critName:  (srv.CRIT_NAME || c.id),
            critDesc:  (srv.CRIT_DESC || ""),
            grade:     (grade != null ? String(grade) : ""),
            weightStr: weightPctStr,
            comment:   comment
          };
        });

        const avg = (sumW > 0) ? (sumWeighted / sumW) : 0;
        const avgStr = avg.toFixed(2);

        // ExcelJS formatting 
        const ExcelJS = await this._loadExcelJS();
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Performance Evaluation");

        
        const COL_HEADER  = "FFC6E0B4"; // 37 - light green
        const COL_GRAY    = "FFD9D9D9"; // 15 - gray
        const COL_LEGEND  = "FFFFD966"; // 19 - yellow
        const COL_BORDER  = "FFFFFFFF"; // white

       
        ws.columns = [
          { key: "c1", width: 20 },
          { key: "c2", width: 40 },
          { key: "c3", width: 10 },
          { key: "c4", width: 10 },
          { key: "c5", width: 50 }
        ];

        const fmtFill = (cell, argb) => cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
        const fmtBold = (cell) => cell.font = Object.assign({}, cell.font || {}, { bold: true });
        const fmtSize = (cell, size) => cell.font = Object.assign({}, cell.font || {}, { size });
        const fmtWrap = (cell) => cell.alignment = Object.assign({}, cell.alignment || {}, { wrapText: true, horizontal: "left", vertical: "top" });
        const fmtBorderAll = (cell) => cell.border = {
          top:    { style: "thin", color: { argb: COL_BORDER } },
          left:   { style: "thin", color: { argb: COL_BORDER } },
          bottom: { style: "thin", color: { argb: COL_BORDER } },
          right:  { style: "thin", color: { argb: COL_BORDER } }
        };

        let r = 1;

        // titlu
        ws.mergeCells(`A${r}:E${r}`);
        const title = ws.getCell(`A${r}`);
        title.value = "PERFORMANCE EVALUATION REPORT";
        fmtSize(title, 14); fmtBold(title); fmtFill(title, COL_HEADER); fmtWrap(title); fmtBorderAll(title);
        r += 1;

        // informatii user
        const yearVal   = this._formatYear(req.REQUEST_DATE);
        const career    = (emp && (emp.CAREER_LVL || emp.CAREER_LV)) || "";
        const today     = new Date();
        const todayStr  = `${String(today.getDate()).padStart(2,"0")}.${String(today.getMonth()+1).padStart(2,"0")}.${today.getFullYear()}`;

        const infoPairs = [
          ["Year:",            yearVal],
          ["Employee Name:",   emp?.NAME || ""],
          ["Personal Number:", emp?.PERSONAL_NR || ""],
          ["Current Level:",   career],
          ["SU:",              emp?.SU || ""],
          ["PEG number:",      req.PEG_REQ_NR || ""],
          ["Project:",         projectLine],
          ["Evaluator:",       mgr?.NAME || ""],
          ["Date:",            todayStr]
        ];

        infoPairs.forEach(([label, val]) => {
          const c1 = ws.getCell(`A${r}`); const c2 = ws.getCell(`B${r}`);
          c1.value = label; c2.value = val;
          [c1, c2].forEach(c => { fmtFill(c, COL_GRAY); fmtWrap(c); fmtBorderAll(c); });
          r += 1;
        });

        // EVALUATION RESULTS
        ws.mergeCells(`A${r}:E${r}`);
        const hdr = ws.getCell(`A${r}`);
        hdr.value = "EVALUATION RESULTS";
        fmtSize(hdr, 14); fmtBold(hdr); fmtFill(hdr, COL_HEADER); fmtWrap(hdr); fmtBorderAll(hdr);
        r += 1;

       
        ["Criterion","Description","Grade","Weight","Comments"].forEach((h, i) => {
          const c = ws.getCell(r, i + 1);
          c.value = h; fmtBold(c); fmtFill(c, COL_HEADER); fmtWrap(c); fmtBorderAll(c);
        });
        r += 1;

      
        rowsData.forEach(row => {
          [row.critName, row.critDesc, row.grade, row.weightStr, row.comment].forEach((v, i) => {
            const c = ws.getCell(r, i + 1);
            c.value = v; fmtFill(c, COL_GRAY); fmtWrap(c); fmtBorderAll(c);
          });
          r += 1;
        });

        // Average
        const avgLabel = ws.getCell(`A${r}`);
        const avgVal   = ws.getCell(`B${r}`);
        avgLabel.value = "GRADE AVERAGE"; fmtBold(avgLabel); fmtFill(avgLabel, COL_HEADER); fmtWrap(avgLabel); fmtBorderAll(avgLabel);
        avgVal.value   = avgStr;          fmtBold(avgVal);   fmtFill(avgVal,   COL_HEADER); fmtWrap(avgVal);   fmtBorderAll(avgVal);
        r += 2;

        // Legend
        ws.mergeCells(`A${r}:E${r}`);
        const leg = ws.getCell(`A${r}`);
        leg.value = "GRADE LEGEND";
        fmtBold(leg); fmtFill(leg, COL_LEGEND); fmtWrap(leg); fmtBorderAll(leg);
        r += 1;

        [
          ["1", "Does not meet expectations"],
          ["2", "Usually meets expectations"],
          ["3", "Always meets expectations"],
          ["4", "Usually exceeds expectations"],
          ["5", "Consistently exceeds expectations"]
        ].forEach(([g, text]) => {
          const c1 = ws.getCell(`A${r}`); const c2 = ws.getCell(`B${r}`);
          c1.value = g; fmtBold(c1); fmtWrap(c1); fmtBorderAll(c1);
          c2.value = text; fmtWrap(c2); fmtBorderAll(c2);
          r += 1;
        });

        // salvare
        const ts = new Date().toISOString().replace(/[:.-]/g, "").slice(0, 15);
        const fileName = `PEG_Report_${req.PEG_REQ_NR || "export"}_${ts}.xlsx`;
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        MessageToast.show("Excel report generated.");
        this.getView().setBusy(false);

      } catch (e) {
        this.getView().setBusy(false);
        MessageBox.error("Failed to build the Excel report.");
      }
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("ManagerDashboard");
    }

  });
});
