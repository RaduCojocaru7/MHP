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

    /* ====== proprietăți ====== */
    _mgr: { id: "", name: "" },
    _pmMode: "sent",
    _userById: Object.create(null),
    _projById: Object.create(null),

    _normId: function (v) {
      if (v === undefined || v === null) { return ""; }
      var s = String(v).trim();
      if (/^\d+$/.test(s) && s.length < 3) { s = s.padStart(3, "0"); }
      return s;
    },

    onInit: function () {
      // model lookup pentru rebind în UI
      this._lkp = new JSONModel({ userById: {}, projById: {} });
      this.getView().setModel(this._lkp, "lkp");

      // modelul local pentru dialog (îl ținem o singură dată)
      this._selectedUserModel = new JSONModel({});
      this._selectedUserModel.setDefaultBindingMode("TwoWay");
      this.getView().setModel(this._selectedUserModel, "selectedUser");

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

        // 2) lookup map + PM req
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

      if (oLogged) {
        var id   = oLogged.getProperty("/user_id")  || oLogged.getProperty("/USER_ID")  || "";
        var name = oLogged.getProperty("/fullName") || oLogged.getProperty("/NAME")     || "";
        if (id || name) {
          try { if (id) localStorage.setItem("loggedUserId", id); } catch (e) {}
          return Promise.resolve({ id: id, name: name });
        }
      }

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
        oItem.addEventDelegate({ ondblclick: function () {
          this._onItemDblClick(oItem);
        }.bind(this) }, this);
      }.bind(this));
    },

    /* === DUBLU-CLICK: populate + open dialog === */
    _onItemDblClick: function (oItem) {
      var oCtx  = oItem.getBindingContext("mainService") || oItem.getBindingContext();
      if (!oCtx) { return; }
      var oData = oCtx.getObject();
      if (!oData) { return; }

      // inițiale pentru avatar
      var initials = "";
      if (oData.NAME) {
        initials = oData.NAME.trim()
          .split(/\s+/).map(function (s) { return s[0]; })
          .join("").toUpperCase().slice(0, 2);
      }

      // fiscal year doar anul (ex: 2025)
      var fiscalYear = oData.FISCAL_YR;
      try {
        var d = new Date(fiscalYear);
        if (!isNaN(d.getTime())) { fiscalYear = d.getFullYear(); }
      } catch (e) { /* ignore */ }

      // mapare OData -> model local
      var payload = {
        initials:    initials,
        fullName:    oData.NAME || "",
        email:       oData.EMAIL || "",
        personalNr:  oData.PERSONAL_NR || "",
        serviceUnit: oData.SU || "",
        role:        oData.ROLE || "",
        careerLevel: oData.CAREER_LV || "",
        fiscalYear:  fiscalYear || ""
      };

      this._selectedUserModel.setData(payload);

      // asigură-te că fragmentul e încărcat și legat la model
      this._ensureTeamDialog().then(function () {
        this._oTeamDialog.setModel(this._selectedUserModel, "selectedUser");
        this._oTeamDialog.open();
      }.bind(this));
    },

    _ensureTeamDialog: function () {
      if (this._oTeamDialog) { return Promise.resolve(); }
      return Fragment.load({
        id: this.getView().getId(),                   // important pentru ID-uri unice
        name: "fbtool.view.TeamMemberDialog",
        controller: this
      }).then(function (oDialog) {
        this._oTeamDialog = oDialog;
        this.getView().addDependent(oDialog);         // moștenește modelele view-ului
      }.bind(this));
    },

    onCloseTeamDialog: function () {
      if (this._oTeamDialog) { this._oTeamDialog.close(); }
    },

    /* ===================== PM FEEDBACK REQUESTS ===================== */

    _initPmRequestsSection: function () {
      console.log("Manager info:", this._mgr); // debug
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
      
      console.log("Applying PM filters - Manager:", this._mgr, "Mode:", this._pmMode); // debug
      
      if (!oBinding) {
        console.log("No binding found, will retry after updateFinished");
        oTable.attachEventOnce("updateFinished", this._applyPmReqFilters, this);
        return;
      }
      
      if (!this._mgr || !this._mgr.id) {
        console.log("No manager ID available");
        return;
      }

      var managerId = this._normId(this._mgr.id); // normalizează ID-ul
      console.log("Using manager ID:", managerId, "Original:", this._mgr.id);
      
      var a = [];
      if (this._pmMode === "received") {
        // Pentru "received" - cereri primite de mine (eu sunt TO_MNGR_ID)
        a.push(new Filter("TO_MNGR_ID", FilterOperator.EQ, managerId));
      } else {
        // Pentru "sent" - cereri trimise de mine (eu sunt FROM_MNGR_ID)
        a.push(new Filter("FROM_MNGR_ID", FilterOperator.EQ, managerId));
      }
      
      console.log("Applying filters:", a);
      oBinding.filter(a, "Application");
      
      // Refresh binding pentru a forța încărcarea
      try { 
        oBinding.refresh(true); 
      } catch (e) {
        console.log("Error refreshing binding:", e);
      }
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
                m[raw]  = name;
                m[norm] = name;
                
                // Adaugă și varianta cu padStart pentru compatibilitate
                if (raw !== norm) {
                  m[raw.padStart(3, "0")] = name;
                }
              }
            }.bind(this));
            
            console.log("Loaded user names:", Object.keys(m).length, "entries");
            console.log("Sample entries:", Object.keys(m).slice(0, 5));
            
            this._userById = m;
            this._lkp.setProperty("/userById", m);
            resolve();
          }.bind(this),
          error: function (err) { 
            console.log("Error loading user names:", err);
            resolve(); 
          }
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
            this._lkp.setProperty("/projById", m);
            resolve();
          }.bind(this),
          error: function () { resolve(); }
        });
      }.bind(this));
    },

    // (acestea sunt folosite în bindings din view pentru PM Requests)
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

    fmtDateShort: function (sDate) {
      if (!sDate) return "";
      var d = new Date(sDate);
      if (isNaN(d.getTime())) return sDate;
      return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

  });
});