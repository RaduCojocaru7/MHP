sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/m/MessageToast",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel"
], function (Controller, Filter, FilterOperator, Sorter, MessageToast, Fragment, JSONModel) {
  "use strict";

  return Controller.extend("fbtool.controller.MyTeam", {

    /* ====== proprietăți interne ====== */
    _mgr: { id: "", name: "" },        // managerul logat: USER_ID + NAME
    _pmMode: "sent",                   // "sent" | "received" (pentru tabelul PM)
    _userById: Object.create(null),    // cache JS (opțional)
    _projById: Object.create(null),    // cache JS (opțional)

    /* Normalizează un ID la string; dacă e numeric scurt -> 3 cifre (3 -> 003) */
    _normId: function (v) {
      if (v === undefined || v === null) { return ""; }
      var s = String(v).trim();
      if (/^\d+$/.test(s) && s.length < 3) { s = s.padStart(3, "0"); }
      return s;
    },

    onInit: function () {
      // model pentru lookup-uri (pentru ca UI5 să re-execute bind-urile când se încarcă)
      this._lkp = new JSONModel({ userById: {}, projById: {} });
      this.getView().setModel(this._lkp, "lkp");

      var oRouter = this.getOwnerComponent().getRouter();
      if (oRouter.getRoute("MyTeam")) {
        oRouter.getRoute("MyTeam").attachPatternMatched(this._onRouteMatched, this);
      } else {
        this._onRouteMatched();
      }
    },

    _onRouteMatched: function () {
      this._resolveManagerInfo().then(function (oMgr) {
        this._mgr = oMgr || { id: "", name: "" };
        if (!this._mgr.name) {
          MessageToast.show("Nu pot identifica managerul logat.");
          return;
        }

        // 1) lista echipă
        this._applyFiltersSafely();

        // 2) încărcăm lookup-urile (user/proiect) și pornim secțiunea PM
        Promise.all([ this._loadUserNames(), this._loadProjectNames() ])
          .then(this._initPmRequestsSection.bind(this));
      }.bind(this));
    },

    onBack: function () {
      sap.ui.core.UIComponent.getRouterFor(this).navTo("ManagerDashboard");
    },

    /* ===================== LISTA ECHIPĂ ===================== */

    _applyFiltersSafely: function () {
      var oTable = this.byId("teamTable");
      var oBinding = oTable && oTable.getBinding("items");

      if (!oBinding) {
        oTable.attachEventOnce("updateFinished", this._applyFiltersSafely, this);
        return;
      }

      this._applyFilters();
      try { oBinding.refresh(true); } catch (e) {}

      // dublu-click pe rând
      oTable.detachUpdateFinished(this._wireDblClickForItems, this);
      oTable.attachUpdateFinished(this._wireDblClickForItems, this);
      this._wireDblClickForItems();
    },

    _applyFilters: function () {
      var sName = (this._mgr.name || "").trim();
      if (!sName) { return; }

      var oTable   = this.byId("teamTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) { return; }

      var oFilterTeam = new Filter({
        and: false,
        filters: [
          new Filter("TEAM_MNGR", FilterOperator.EQ, sName),
          new Filter("TEAM_MNGR", FilterOperator.EQ, sName.toUpperCase())
        ]
      });

      oBinding.filter([oFilterTeam], "Application");
      oBinding.sort([ new Sorter("NAME", false) ]);
    },

    _resolveManagerInfo: function () {
      var oComp   = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");
      var oModel  = oComp.getModel("mainService");

      // 1) din modelul loggedUser
      if (oLogged) {
        var id   = oLogged.getProperty("/user_id")  || oLogged.getProperty("/USER_ID")  || "";
        var name = oLogged.getProperty("/fullName") || oLogged.getProperty("/NAME")     || "";
        if (id || name) {
          try { if (id) localStorage.setItem("loggedUserId", id); } catch (e) {}
          return Promise.resolve({ id: id, name: name });
        }
      }

      // 2) fallback după email -> UserSet
      var email = oLogged && (oLogged.getProperty("/email") || oLogged.getProperty("/EMAIL")) || "";
      if (!email || !oModel) { return Promise.resolve({ id: "", name: "" }); }

      return new Promise(function (resolve) {
        oModel.read("/UserSet", {
          filters: [ new Filter("EMAIL", FilterOperator.EQ, email.toUpperCase()) ],
          urlParameters: { "$select": "USER_ID,NAME" },
          success: function (oData) {
            var r = (oData && oData.results && oData.results[0]) || null;
            resolve({ id: r && r.USER_ID || "", name: r && r.NAME || "" });
          },
          error: function () { resolve({ id: "", name: "" }); }
        });
      });
    },

    _wireDblClickForItems: function () {
      var oTable = this.byId("teamTable");
      if (!oTable) { return; }

      oTable.getItems().forEach(function (oItem) {
        if (oItem.__dblBound) { return; }
        oItem.__dblBound = true;
        oItem.addEventDelegate({
          ondblclick: function () { this._onItemDblClick(oItem); }.bind(this)
        }, this);
      }.bind(this));
    },

    _onItemDblClick: function (oItem) {
      var oCtx  = oItem.getBindingContext("mainService") || oItem.getBindingContext();
      if (!oCtx) { return; }
      var oData = oCtx.getObject();
      if (!oData) { return; }

      if (!this._selectedUserModel) {
        this._selectedUserModel = new JSONModel({});
        this._selectedUserModel.setDefaultBindingMode("TwoWay");
        this.getView().setModel(this._selectedUserModel, "selectedUser");
      }

      var initials = "";
      if (oData.NAME) {
        initials = oData.NAME.trim().split(/\s+/).map(function (s) { return s[0]; })
          .join("").toUpperCase().slice(0, 2);
      }

      var oPayload = {
        initials:    initials,
        fullName:    oData.NAME,
        email:       oData.EMAIL,
        personalNr:  oData.PERSONAL_NR,
        serviceUnit: oData.SU,
        role:        oData.ROLE,
        careerLevel: oData.CAREER_LV,
        fiscalYear:  oData.FISCAL_YR
      };
      this._selectedUserModel.setData(oPayload);

      if (!this._oTeamDialog) {
        Fragment.load({
          id: this.getView().getId(),
          name: "fbtool.view.TeamMemberDialog",
          controller: this
        }).then(function (oDialog) {
          this._oTeamDialog = oDialog;
          this.getView().addDependent(oDialog);
          this._oTeamDialog.setModel(this._selectedUserModel, "selectedUser");
          this._oTeamDialog.open();
        }.bind(this));
      } else {
        this._oTeamDialog.setModel(this._selectedUserModel, "selectedUser");
        this._oTeamDialog.open();
      }
    },

    onCloseTeamDialog: function () {
      if (this._oTeamDialog) { this._oTeamDialog.close(); }
    },

    /* ===================== PM FEEDBACK REQUESTS (manager ↔ project manager) ===================== */

    _initPmRequestsSection: function () {
      var oSel = this.byId("pmModeSelect");
      if (oSel && oSel.getSelectedKey() !== this._pmMode) {
        oSel.setSelectedKey(this._pmMode);
      }
      this._applyPmReqFilters();
    },

    onPmModeChange: function (oEvent) {
      this._pmMode = oEvent.getSource().getSelectedKey() === "received" ? "received" : "sent";
      this._applyPmReqFilters();
    },

    _applyPmReqFilters: function () {
      var oTable   = this.byId("pmReqTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding || !this._mgr || !this._mgr.id) { return; }

      var a = [];
      if (this._pmMode === "received") {
        a.push(new Filter("TO_MNGR_ID",   FilterOperator.EQ, this._mgr.id));
      } else {
        a.push(new Filter("FROM_MNGR_ID", FilterOperator.EQ, this._mgr.id));
      }
      oBinding.filter(a, "Application");
    },

    /* ===== Lookups + formatters ===== */
    _loadUserNames: function () {
      var oModel = this.getOwnerComponent().getModel("mainService");
      return new Promise(function (resolve) {
        if (!oModel) { resolve(); return; }
        oModel.read("/UserSet", {
          urlParameters: { "$select": "USER_ID,NAME" },
          success: function (oData) {
            var m = Object.create(null);
            (oData.results || []).forEach(function (u) {
              if (u.USER_ID) {
                var raw  = String(u.USER_ID).trim();
                var norm = this._normId(u.USER_ID);
                var name = u.NAME || raw;
                m[raw]  = name;   // "3"
                m[norm] = name;   // "003"
              }
            }.bind(this));

            this._userById = m;                 // cache JS (opțional)
            this._lkp.setProperty("/userById", m); // <- declanșează re-binding în view
            resolve();
          }.bind(this),
          error: function () { resolve(); }
        });
      }.bind(this));
    },

    _loadProjectNames: function () {
      var oModel = this.getOwnerComponent().getModel("mainService");
      return new Promise(function (resolve) {
        if (!oModel) { resolve(); return; }
        oModel.read("/User_ProjectsSet", {
          urlParameters: { "$select": "PROJ_ID,PROJ_NAME" },
          success: function (oData) {
            var m = Object.create(null);
            (oData.results || []).forEach(function (p) {
              if (p.PROJ_ID && p.PROJ_NAME && !m[p.PROJ_ID]) {
                m[p.PROJ_ID] = p.PROJ_NAME;
              }
            });
            this._projById = m;
            this._lkp.setProperty("/projById", m); // trigger UI update
            resolve();
          }.bind(this),
          error: function () { resolve(); }
        });
      }.bind(this));
    },

    // Formatter care primește ID + harta și întoarce numele
    fmtUserNameMap: function (vId, m) {
      m = m || {};
      if (vId === undefined || vId === null) { return ""; }
      var raw  = String(vId).trim();
      var norm = this._normId(vId);
      return m[norm] || m[raw] || raw;
    },

    fmtProjFromMap: function (vId, m) {
      m = m || {};
      if (vId === undefined || vId === null) { return ""; }
      var key = String(vId).trim();
      return m[key] || key;
    },

    // rămân și formatter-ele single-param (dacă le mai folosești în altă parte)
    fmtUserName: function (v) {
      if (v === undefined || v === null) { return ""; }
      var raw  = String(v).trim();
      var norm = this._normId(v);
      return this._userById[norm] || this._userById[raw] || raw;
    },
    fmtProjName: function (sProjId) {
      return sProjId ? (this._projById[sProjId] || sProjId) : "";
    },

    fmtDateShort: function (sDate) {
      if (!sDate) return "";
      var d = new Date(sDate);
      if (isNaN(d.getTime())) return sDate;
      return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

  });
});
