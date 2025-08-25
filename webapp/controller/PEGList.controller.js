sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/ui/core/UIComponent",
  "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, Sorter, UIComponent, MessageToast) {
  "use strict";

  return Controller.extend("fbtool.controller.PEGList", {

    onInit: function () {
      this._sUserId = "";
      this._userById = Object.create(null);      
      this._projById = Object.create(null);     
      this._isManager = false;

      // Initialize data loading
      this._initializeData();
      
      // Listen for route matched events to refresh when navigating to this view
      var oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("PEGList").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function() {
      // Small delay to ensure the loggedUser model is set from login
      setTimeout(function() {
        this._initializeData();
      }.bind(this), 100);
    },

    _initializeData: function() {
      this._sUserId = "";
      this._userById = Object.create(null);
      this._projById = Object.create(null);
      this._isManager = false;

      // Clear existing model 
      this._clearPEGModel();

      // Load fresh data and user info
      Promise.all([
        this._loadUserNames(),
        this._loadProjectNames(),
        this._resolveFromUserId(),
        this._checkUserRole()
      ]).then(function () {
        if (!this._sUserId) {
          MessageToast.show("Nu pot identifica utilizatorul logat.");
          this._loadEmptyModel();
          return;
        }
        
        // Load PEG data from OData
        this._loadPEGData();
        
      }.bind(this)).catch(function(error) {
        console.error("Error loading PEG data:", error);
        MessageToast.show("Eroare la încărcarea datelor PEG.");
        this._loadEmptyModel();
      }.bind(this));
    },

    _clearPEGModel: function() {
      // Clear the model data
      var oEmptyModel = new JSONModel({
        allRequests: [],
        requests: [],
        statuses: [{ key: "All", text: "All" }],
        selectedStatus: "All"
      });
      
      this.getView().setModel(oEmptyModel, "peg");
      
      // Clear any existing list binding
      var oList = this.byId("pegList");
      if (oList) {
        var oBinding = oList.getBinding("items");
        if (oBinding) {
          oBinding.filter([]);
          oBinding.sort([]);
        }
      }
    },

    /* ===== User Management ===== */
    _checkUserRole: function() {
      var oComp = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");
      
      if (oLogged) {
        var userData = oLogged.getData();
        var role = (userData.role || "").toLowerCase();
        this._isManager = (role === "manager");
      }
      
      return Promise.resolve();
    },

    _resolveFromUserId: function () {
      var oComp = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");

      if (oLogged) {
        var data = oLogged.getData();
        var id = data.userId || data.user_id || data.USER_ID || "";
        if (id) { 
          this._sUserId = id;
          return Promise.resolve(); 
        }
      }
      
      try {
        var cached = localStorage.getItem("loggedUserId") || "";
        if (cached) { 
          this._sUserId = cached;
          return Promise.resolve(); 
        }
      } catch (e) {
        console.warn("Cannot access localStorage:", e);
      }
      
      this._sUserId = "";
      return Promise.resolve();
    },

    _loadUserNames: function () {
      var oModel = this.getOwnerComponent().getModel() ||
                   this.getOwnerComponent().getModel("mainService");
      return new Promise(function (resolve) {
        if (!oModel) { 
          resolve(); 
          return; 
        }
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
          error: function (error) { 
            console.error("Failed to load user names:", error);
            resolve();
          }
        });
      }.bind(this));
    },

    _loadProjectNames: function () {
      var oModel = this.getOwnerComponent().getModel() ||
                   this.getOwnerComponent().getModel("mainService");
      return new Promise(function (resolve) {
        if (!oModel) { 
          resolve(); 
          return; 
        }
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
          error: function (error) { 
            console.error("Failed to load project names:", error);
            resolve(); 
          }
        });
      }.bind(this));
    },

    /* ===== PEG Data Loading ===== */
    _loadPEGData: function() {
      var oModel = this.getOwnerComponent().getModel() ||
                   this.getOwnerComponent().getModel("mainService");
                   
      if (!oModel) {
        this._loadEmptyModel();
        return;
      }

      // Build filters based on user role
      var aFilters = [];
      var oLoggedUser = this.getOwnerComponent().getModel("loggedUser")?.getData();
      var sRole = oLoggedUser?.role?.toLowerCase();

      if (sRole === "manager") {
        aFilters.push(new Filter("MANAGER_ID", FilterOperator.EQ, this._sUserId));
      } else if (sRole === "hr") {
        // HR sees all, no filter
      } else {
        aFilters.push(new Filter("USER_ID", FilterOperator.EQ, this._sUserId));
      }
      
      oModel.read("/Peg_RequestSet", {
        filters: aFilters,
        urlParameters: { 
          "$orderby": "REQUEST_DATE desc"
        },
        success: function(oData) {
          this._processPEGData(oData.results || []);
        }.bind(this),
        error: function(oError) {
          console.error("Failed to load PEG data:", oError);
          MessageToast.show("Nu s-au putut încărca datele PEG din server.");
          this._loadEmptyModel();
        }.bind(this)
      });
    },

    _processPEGData: function(aPEGData) {
      // Transform OData to format expected by your view
      var aProcessed = aPEGData.map(function(oPEG) {
        var sDisplayStatus = this._getDisplayStatus(oPEG.STATUS, oPEG);
        var sTitle = "PEG Request #" + (oPEG.PEG_REQ_NR || oPEG.PEG_ID);

        var oDateObj = new Date(oPEG.REQUEST_DATE);
        
        return {
          id: oPEG.PEG_ID,
          title: sTitle,
          status: sDisplayStatus,
          originalStatus: oPEG.STATUS,
          createdDate: this._formatDate(oPEG.REQUEST_DATE),
          createdDateObj: oDateObj,
          requesterName: this._getUserName(oPEG.USER_ID),
          managerName: this._getUserName(oPEG.MANAGER_ID),
          projectId: oPEG.PROJ_ID,
          projectNumber: oPEG.PROJ_NUMBER,
          projectName: this._getProjectName(oPEG.PROJ_ID),
          // Keep original data for reference
          _original: oPEG
        };
      }.bind(this));

      // Extract unique statuses (use display statuses)
      var aStatusSet = new Set(aProcessed.map(r => r.status).filter(Boolean));
      var aStatuses = [{ key: "All", text: "All" }]
        .concat(Array.from(aStatusSet).sort().map(s => ({ key: s, text: s })));

      // Create model for view
      var oLocal = new JSONModel({
        allRequests: aProcessed,
        requests: aProcessed,
        statuses: aStatuses,
        selectedStatus: "All"
      });
      
      this.getView().setModel(oLocal, "peg");
      this._applySorting();
    },

    _getDisplayStatus: function(sBackendStatus, oPEGData) {
      if (!sBackendStatus) return "Unknown";
      
      var sStatus = sBackendStatus.toLowerCase();
      
      if (this._isManager) {
        // MANAGER VIEW
        switch (sStatus) {
          case "pending":
            return "To Review";
          case "done":
            return "Sent";
          default:
            return sBackendStatus;
        }
      } else {
        // USER VIEW
        switch (sStatus) {
          case "pending":
            return "Pending";
          case "done":
            return "Done";
          default:
            return sBackendStatus;
        }
      }
    },

    _loadEmptyModel: function() {
      var oEmptyModel = new JSONModel({
        allRequests: [],
        requests: [],
        statuses: [{ key: "All", text: "All" }],
        selectedStatus: "All"
      });
      
      this.getView().setModel(oEmptyModel, "peg");
    },

    /* ===== Filtering & Sorting ===== */
    onStatusFilterChange: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem")?.getKey()
              || oEvent.getSource().getSelectedKey();

      var oModel = this.getView().getModel("peg");
      var aAll = oModel.getProperty("/allRequests") || [];

      var aFiltered = (sKey === "All") ? aAll : aAll.filter(r => r.status === sKey);
      oModel.setProperty("/requests", aFiltered);
      oModel.setProperty("/selectedStatus", sKey);

      // Re-apply simple sorting after filtering
      this._applySorting();
    },

    _applySorting: function () {
      var oList = this.byId("pegList");
      var oBinding = oList && oList.getBinding("items");
      if (!oBinding) return;

      // Simple sort by date (newest first) - NO grouping
      var oDateSorter = new Sorter("createdDateObj", true);
      oBinding.sort([oDateSorter]);
    },

    /* ===== Navigation ===== */
    onNavBack: function () {
      var role = this.getOwnerComponent().getModel("loggedUser")?.getProperty("/role");
      var sRole = role.toLowerCase().trim();
      var sTarget;
      if (sRole === "manager") {
        sTarget = "ManagerDashboard";
      } else if (sRole === "hr") {
        sTarget = "HRDashboard";
      } else {
        sTarget = "UserDashboard";
      }
      UIComponent.getRouterFor(this).navTo(sTarget);
    },

    /* ===== Utility Functions ===== */
    _getUserName: function(sUserId) {
      if (!sUserId) return "";
      return (this._userById && this._userById[sUserId]) || sUserId;
    },

    _getProjectName: function(sProjId) {
      if (!sProjId) return "";
      return (this._projById && this._projById[sProjId]) || sProjId;
    },

    _formatDate: function(oDate) {
      if (!oDate) return "";
      
      var oDateObj = new Date(oDate);
      if (isNaN(oDateObj.getTime())) {
        return oDate; // fallback dacă nu se poate converti
      }
      
      return oDateObj.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    },

    /* ===== Formatters ===== */
    formatStatusState: function(sStatus) {
      if (!sStatus) return "None";
      
      switch (sStatus.toLowerCase()) {
        case "sent":
        case "done":
          return "Success";
        case "to review":
        case "pending":
          return "Warning";
        default: 
          return "None";
      }
    },

    formatDateOnly: function(sDate) {
      return this._formatDate(sDate);
    },

    formatFromToDisplay: function(sRequesterName, sManagerName) {
      if (this._isManager) {
        return "From: " + (sRequesterName || "Unknown");
      } else {
        return "To Project Manager: " + (sManagerName || "Unknown");
      }
    },

    formatPEGDescription: function(sDate, sRequester, sManager, sProjectName) {
      var aParts = [];
      
      if (sDate) {
        aParts.push(sDate);
      }
      
      // Different display based on user role
      if (this._isManager) {
        // Manager sees "From: [requester name]"
        if (sRequester) {
          aParts.push("From: " + sRequester);
        }
      } else {
        // User sees "To Manager: [manager name]"
        if (sManager) {
          aParts.push("To Manager: " + sManager);
        }
      }
      
      // Use project name instead of number
      if (sProjectName) {
        aParts.push("Project: " + sProjectName);
      }
      
      return aParts.join(" | ");
    }

  });
});