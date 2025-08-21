sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageToast) {
  "use strict";

  return Controller.extend("fbtool.controller.FeedbackList", {

    onInit: function () {
      this._sMode    = "received";                // "received" | "sent"
      this._sQuery   = "";
      this._sUserId  = "";
      this._userById = Object.create(null);       // USER_ID -> NAME
      this._typeById = Object.create(null);       // FB_TYPE_ID -> TYPE
      this._projById = Object.create(null);       // PROJ_ID -> PROJ_NAME

      // Încarcă lookup-urile (user, type, project) apoi leagă lista
      Promise.all([
        this._loadUserNames(),
        this._loadTypeNames(),
        this._loadProjectNames()
      ]).then(function () {
        return this._resolveFromUserId();
      }.bind(this)).then(function (sUserId) {
        this._sUserId = sUserId || "";
        if (!this._sUserId) {
          MessageToast.show("Nu pot identifica utilizatorul logat.");
          return;
        }
        // sincronizează dropdown-ul cu starea internă
        var oSel = this.byId("modeSelect");
        if (oSel && oSel.getSelectedKey() !== this._sMode) {
          oSel.setSelectedKey(this._sMode);
        }
        this._applyFilters();
      }.bind(this));
    },

    /* ===== Lookups ===== */
    _loadUserNames: function () {
      var oModel = this.getOwnerComponent().getModel("mainService");
      return new Promise(function (resolve) {
        if (!oModel) { resolve(); return; }
        oModel.read("/UserSet", {
          urlParameters: { "$select": "USER_ID,NAME" },
          success: function (oData) {
            var map = Object.create(null);
            (oData.results || []).forEach(function (u) {
              if (u.USER_ID) { map[u.USER_ID] = u.NAME || u.USER_ID; }
            });
            this._userById = map;
            resolve();
          }.bind(this),
          error: function () { resolve(); }
        });
      }.bind(this));
    },

    _loadTypeNames: function () {
      var oModel = this.getOwnerComponent().getModel("mainService");
      return new Promise(function (resolve) {
        if (!oModel) { resolve(); return; }
        oModel.read("/Feedback_TypeSet", {
          urlParameters: { "$select": "FB_TYPE_ID,TYPE" },
          success: function (oData) {
            var map = Object.create(null);
            (oData.results || []).forEach(function (t) {
              if (t.FB_TYPE_ID) { map[t.FB_TYPE_ID] = t.TYPE || t.FB_TYPE_ID; }
            });
            this._typeById = map;
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
        // Dacă ai un ProjectsSet dedicat, folosește-l. Altfel, agregăm din User_ProjectsSet.
        oModel.read("/User_ProjectsSet", {
          urlParameters: { "$select": "PROJ_ID,PROJ_NAME" },
          success: function (oData) {
            var map = Object.create(null);
            (oData.results || []).forEach(function (p) {
              if (p.PROJ_ID && p.PROJ_NAME && !map[p.PROJ_ID]) {
                map[p.PROJ_ID] = p.PROJ_NAME;
              }
            });
            this._projById = map;
            resolve();
          }.bind(this),
          error: function () { resolve(); }
        });
      }.bind(this));
    },

    /* ===== Filtering core ===== */
    _applyFilters: function () {
      var oList = this.byId("fbList");
      var oBinding = oList && oList.getBinding("items");
      if (!oBinding || !this._sUserId) { return; }

      var aFilters = [];
      if (this._sMode === "received") {
        aFilters.push(new Filter("TO_USER_ID",   FilterOperator.EQ, this._sUserId));
      } else {
        aFilters.push(new Filter("FROM_USER_ID", FilterOperator.EQ, this._sUserId));
      }

      if (this._sQuery) {
        aFilters.push(new Filter("INPUT_TEXT", FilterOperator.Contains, this._sQuery));
      }

      oBinding.filter(aFilters, "Application");
    },

    /* ===== UI handlers ===== */
    onModeSelectChange: function (oEvent) {
      var sKey = oEvent.getSource().getSelectedKey();
      this._sMode = (sKey === "sent") ? "sent" : "received";
      this._applyFilters();
    },

    // Dacă activezi searchul în view, decomentează asta:
    // onSearch: function (oEvent) {
    //   var sVal = "";
    //   if (oEvent.getParameter("newValue") !== undefined) {
    //     sVal = oEvent.getParameter("newValue");
    //   } else if (oEvent.getParameter("query") !== undefined) {
    //     sVal = oEvent.getParameter("query");
    //   }
    //   this._sQuery = (sVal || "").trim();
    //   this._applyFilters();
    // },

    onRefresh: function (oEvent) {
      var oList = this.byId("fbList");
      var oBinding = oList && oList.getBinding("items");
      if (oBinding) { oBinding.refresh(true); }
      oEvent.getSource().hide();
    },

    onBack: function () {
  var oComponent = this.getOwnerComponent();
  var oLoggedUserModel = oComponent.getModel("loggedUser");
  var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

  if (oLoggedUserModel) {
    var userData = oLoggedUserModel.getData();
    var role = (userData.role || "").toLowerCase();
    
    if (role === "manager") {
      oRouter.navTo("ManagerDashboard");
    } else {
      oRouter.navTo("UserDashboard");
    }
  } else {
    // Fallback la UserDashboard dacă nu găsim datele utilizatorului
    oRouter.navTo("UserDashboard");
  }
},

    /* ===== Formatters (folosite în XML) ===== */
    fmtUserName: function (sUserId) {
      if (!sUserId) { return ""; }
      return (this._userById && this._userById[sUserId]) || sUserId;
    },

    fmtTypeName: function (sTypeId) {
      if (!sTypeId) { return ""; }
      return (this._typeById && this._typeById[sTypeId]) || sTypeId;
    },

    fmtProjName: function (sProjId) {
      if (!sProjId) { return ""; }
      return (this._projById && this._projById[sProjId]) || sProjId;
    },

    fmtDate: function (sDateYyyyMmDd) {
      if (!sDateYyyyMmDd) { return ""; }
      var s = String(sDateYyyyMmDd);
      if (s.length === 8) {
        var y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
        return d + "." + m + "." + y; // 31.12.2025
      }
      return sDateYyyyMmDd;
    },

    /* ===== Helpers ===== */
    _resolveFromUserId: function () {
      var oComp = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");

      // 1) din model
      if (oLogged) {
        var id = oLogged.getProperty("/user_id") || oLogged.getProperty("/USER_ID") || "";
        if (id) { return Promise.resolve(id); }
      }
      // 2) din cache
      try {
        var cached = localStorage.getItem("loggedUserId") || "";
        if (cached) { return Promise.resolve(cached); }
      } catch (e) {}
      // 3) fallback
      return Promise.resolve("");
    }

  });
});
