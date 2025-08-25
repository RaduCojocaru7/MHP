sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/UIComponent",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/ui/core/BusyIndicator"
], function(Controller, JSONModel, UIComponent, Filter, FilterOperator, MessageToast, BusyIndicator) {
  "use strict";
  
  return Controller.extend("fbtool.controller.PEGRequest", {
    onInit: function() {
      console.log("PEG Request onInit");
      
      // Set up route matched handler to refresh data every time
      var oRouter = UIComponent.getRouterFor(this);
      oRouter.getRoute("PEGRequest").attachPatternMatched(this._onRouteMatched, this);
      
      // Initialize empty PEG model
      this._initializePEGModel();
    },

    _onRouteMatched: function() {
      console.log("PEG Request route matched - refreshing data");
      this._loadDataForCurrentUser();
    },

    _initializePEGModel: function() {
      var oPEGModel = new JSONModel({
        currentDate: new Date().toISOString().slice(0, 10),
        managers: [],
        selectedManager: "",  
        projects: [],
        selectedProject: ""  
      });
      this.getView().setModel(oPEGModel, "peg");
      console.log("PEG model initialized with empty selections");
    },

    _loadDataForCurrentUser: function() {
     
      var oUserModel = this.getOwnerComponent().getModel("loggedUser");
      if (oUserModel) {
        this.getView().setModel(oUserModel, "user");
        
        var sUserId = oUserModel.getProperty("/userId");
        console.log("Loading data for user:", sUserId);
        
        this._initializePEGModel();
        this._loadUserProjects(sUserId);
      } else {
        console.error("No logged user found!");
        UIComponent.getRouterFor(this).navTo("Login");
      }
    },

    onProjectSelectionChange: function() {
      var oPEGModel = this.getView().getModel("peg");
      var sSelectedProjectId = oPEGModel.getProperty("/selectedProject");
      
      console.log("Project selected:", sSelectedProjectId);
      
      if (sSelectedProjectId) {
        oPEGModel.setProperty("/selectedManager", "");
        oPEGModel.setProperty("/managers", []);
        
        this._loadProjectManagers(sSelectedProjectId);
      } else {
        oPEGModel.setProperty("/managers", []);
        oPEGModel.setProperty("/selectedManager", "");
      }
    },

    _loadProjectManagers: function(sProjectId) {
      var oModel = this.getOwnerComponent().getModel() || 
                   this.getOwnerComponent().getModel("mainService");

      if (!oModel) {
        MessageToast.show("OData model not available");
        return;
      }

      console.log("Loading managers for project ID:", sProjectId);
      
      BusyIndicator.show(0);
      
      var aFilters = [
        new Filter("PROJ_ID", FilterOperator.EQ, sProjectId)
      ];

      oModel.read("/Manager_ProjectsSet", {
        filters: aFilters,
        success: function(oData) {
          console.log("Manager-Project relationships:", oData);
          
          if (oData && oData.results && oData.results.length > 0) {
            var aManagerIds = oData.results.map(function(item) {
              return item.MNGR_ID;
            });
            
            console.log("Manager IDs for project:", aManagerIds);
            
            this._loadManagersByIds(aManagerIds);
          } else {
            BusyIndicator.hide();
            console.warn("No managers found for project:", sProjectId);
            MessageToast.show("No managers assigned to this project");
            
            var oPEGModel = this.getView().getModel("peg");
            oPEGModel.setProperty("/managers", []);
            oPEGModel.setProperty("/selectedManager", "");
          }
        }.bind(this),
        error: function(oError) {
          BusyIndicator.hide();
          console.error("Error loading project managers:", oError);
          MessageToast.show("Error loading project managers. Please try again.");
        }
      });
    },

    _loadManagersByIds: function(aManagerIds) {
      var oModel = this.getOwnerComponent().getModel() || 
                   this.getOwnerComponent().getModel("mainService");

      if (!aManagerIds || aManagerIds.length === 0) {
        BusyIndicator.hide();
        return;
      }

      var aFilters = aManagerIds.map(function(sManagerId) {
        return new Filter("USER_ID", FilterOperator.EQ, sManagerId);
      });
      
      
      var oCombinedFilter = new Filter({
        filters: aFilters,
        and: false 
      });

      console.log("Loading manager details for IDs:", aManagerIds);

      oModel.read("/UserSet", {
        filters: [oCombinedFilter],
        urlParameters: {
          "$select": "USER_ID,NAME,EMAIL,ROLE"
        },
        success: function(oData) {
          BusyIndicator.hide();
          
          console.log("Manager details loaded:", oData);
          
          if (oData && oData.results) {
            var aManagers = oData.results.map(function(manager) {
              return {
                id: manager.USER_ID,
                name: manager.NAME,
                email: manager.EMAIL,
                displayText: manager.NAME  
              };
            });

            // Add placeholder at the beginning
            aManagers.unshift({
              id: "",
              name: "",
              email: "",
              displayText: "-- Select Manager --"
            });

            console.log("Transformed managers:", aManagers);

            var oPEGModel = this.getView().getModel("peg");
            oPEGModel.setProperty("/managers", aManagers);
            
            // Auto-select first manager if only one (excluding placeholder)
            if (aManagers.length === 2) { 
              oPEGModel.setProperty("/selectedManager", aManagers[1].id);
            } else {
              oPEGModel.setProperty("/selectedManager", ""); 
            }

            console.log("Loaded " + (aManagers.length - 1) + " manager(s) for this project");
          }
        }.bind(this),
        error: function(oError) {
          BusyIndicator.hide();
          console.error("Error loading manager details:", oError);
          MessageToast.show("Error loading manager details. Please try again.");
        }
      });
    },

    _loadUserProjects: function(sUserId) {
      if (!sUserId) {
        console.error("No user ID provided for loading projects");
        return;
      }

      var oModel = this.getOwnerComponent().getModel() || 
                   this.getOwnerComponent().getModel("mainService");

      if (!oModel) {
        MessageToast.show("OData model not available");
        return;
      }

      var aFilters = [
        new Filter("USER_ID", FilterOperator.EQ, sUserId)
      ];

      console.log("Loading projects for user ID:", sUserId);
      
      BusyIndicator.show(0);
      
      oModel.read("/User_ProjectsSet", {
        filters: aFilters,
        success: function(oData) {
          BusyIndicator.hide();
          
          console.log("Projects loaded:", oData);
          
          if (oData && oData.results) {
            var aProjects = oData.results.map(function(project) {
              return {
                id: project.PROJ_ID,
                number: project.PROJ_ID,
                name: project.PROJ_NAME || "Project " + project.PROJ_ID,
                userProjId: project.USER_PROJ_ID
              };
            });

            console.log("Transformed projects:", aProjects);

            var oPEGModel = this.getView().getModel("peg");
            oPEGModel.setProperty("/projects", aProjects);
            
            // Explicitly ensure no project is selected initially
            oPEGModel.setProperty("/selectedProject", "");
            
            // Also clear managers since no project is selected
            oPEGModel.setProperty("/managers", []);
            oPEGModel.setProperty("/selectedManager", "");
            
            // Force model refresh to update UI
            oPEGModel.refresh(true);
            
            console.log("Loaded " + aProjects.length + " project(s) - no auto-selection");
            console.log("Current selectedProject value:", oPEGModel.getProperty("/selectedProject"));
          } else {
            console.warn("No projects found for user");
          }
        }.bind(this),
        error: function(oError) {
          BusyIndicator.hide();
          console.error("Error loading user projects:", oError);
          MessageToast.show("Error loading projects. Please try again.");
        }
      });
    },

    onSendRequest: function() {
      var oPEGModel = this.getView().getModel("peg");
      var oUserModel = this.getView().getModel("user");
      
      var oPEGData = oPEGModel.getData();
      var oUserData = oUserModel.getData();
      
      var sSelectedManagerId = oPEGData.selectedManager;
      var oSelectedManager = oPEGData.managers.find(function(mgr) {
        return mgr.id === sSelectedManagerId;
      });
      
      var sSelectedProjectId = oPEGData.selectedProject;
      var oSelectedProject = oPEGData.projects.find(function(proj) {
        return proj.id === sSelectedProjectId;
      });
      
      if (!oSelectedManager) {
        MessageToast.show("Please select a manager");
        return;
      }
      
      if (!oSelectedProject) {
        MessageToast.show("Please select a project");
        return;
      }

      var oRequestDate = new Date(oPEGData.currentDate);
      // Ensure it's midnight UTC
      oRequestDate.setUTCHours(0, 0, 0, 0);
      
      // Prepare data for backend (matching your ABAP structure)
      var oPEGRequestData = {
        USER_ID: oUserData.userId,           
        PROJ_ID: oSelectedProject.id,
        MANAGER_ID: oSelectedManager.id,
        REQUEST_DATE: oRequestDate,
        PROJ_NUMBER: oSelectedProject.number,
        STATUS: "PENDING" ,
        PEG_REQ_NR: ""                    
      };
      
      console.log("Sending PEG request to backend:", oPEGRequestData);
      
      // Get OData model and send to backend
      var oModel = this.getOwnerComponent().getModel() || 
                   this.getOwnerComponent().getModel("mainService");

      if (!oModel) {
        MessageToast.show("OData model not available");
        return;
      }

      BusyIndicator.show(0);

      oModel.create("/Peg_RequestSet", oPEGRequestData, {
        success: function(oData) {
          BusyIndicator.hide();
          console.log("PEG request created successfully:", oData);

          var sPegReqNr = (oData && oData.PEG_REQ_NR) || "";
          var successMsg = "";
          
          if (sPegReqNr) {
            successMsg = "PEG request #" + sPegReqNr + " sent successfully";
          } else {
            successMsg = "PEG request sent successfully";
          }

          if (oSelectedManager.name && oSelectedProject.name) {
            successMsg += " for project '" + oSelectedProject.name + "' to " + oSelectedManager.name;
          }
          successMsg += "!";
          
          MessageToast.show(successMsg);
          
          // Clear selections after successful send
          this._clearSelections();
        }.bind(this),
        error: function(oError) {
          BusyIndicator.hide();
          console.error("Error creating PEG request:", oError);
          
          var sErrorMessage = "Failed to send PEG request. Please try again.";
          try {
            var oErrorData = JSON.parse(oError.responseText);
            if (oErrorData && oErrorData.error && oErrorData.error.message) {
              sErrorMessage = oErrorData.error.message.value || sErrorMessage;
            }
          } catch (e) {
          }
          
          MessageToast.show(sErrorMessage);
        }
      });
    },

    _clearSelections: function() {
      console.log("Clearing form selections...");
      
      var oPEGModel = this.getView().getModel("peg");
      if (oPEGModel) {
        oPEGModel.setProperty("/selectedManager", "");
        oPEGModel.setProperty("/selectedProject", "");
        oPEGModel.setProperty("/managers", []); 
        oPEGModel.setProperty("/currentDate", new Date().toISOString().slice(0, 10));
        
        console.log("Form selections cleared - no project or manager selected");
      }
    },

    onNavBack: function() {
      var role = this.getOwnerComponent().getModel("loggedUser")?.getProperty("/role");
      var sTarget = (role && role.toLowerCase() === "manager") ? "ManagerDashboard" : "UserDashboard";
      UIComponent.getRouterFor(this).navTo(sTarget);
    },
    
    isFormValid: function(sManager, sProject) {
      return !!(sManager && sProject && sManager !== "" && sProject !== "");
    }
  });
});