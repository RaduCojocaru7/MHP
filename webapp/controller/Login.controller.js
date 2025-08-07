sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function(Controller, JSONModel, MessageToast) {
  "use strict";

  return Controller.extend("fbtool.controller.Login", {
    onInit: function () {
      console.log("🚀 Login controller initialized");
      this.clearInputs();

      var oModel = this.getOwnerComponent().getModel("userData");
      if (oModel) {
        console.log("✅ userData model found from manifest");

        var fnCheckData = function() {
          var data = oModel.getData();
          if (data && data.email) {
            console.log("✅ User data loaded:", data);
            MessageToast.show("✅ User data loaded successfully!");
          } else {
            console.log("⏳ Waiting for data to load...");
            setTimeout(fnCheckData, 100);
          }
        };
        fnCheckData();

        this.getView().setModel(oModel, "userData");
      } else {
        console.error("❌ userData model not found in manifest");
        MessageToast.show("❌ User data model not configured properly");
      }
    },

    clearInputs: function () {
      try {
        const savedEmail = localStorage.getItem("savedEmail") || "";
        this.byId("emailInput").setValue(savedEmail);
        this.byId("passwordInput").setValue("");
      } catch (e) {
        console.warn("Could not reset inputs:", e);
      }
    },

    onLogin: function () {
      var emailInput = this.byId("emailInput").getValue().trim();
      var passwordInput = this.byId("passwordInput").getValue().trim();

      if (!emailInput || !passwordInput) {
        MessageToast.show("Please enter both email and password.");
        return;
      }

      var oModel = this.getOwnerComponent().getModel("userData") || 
                   this.getView().getModel("userData");

      if (!oModel) {
        MessageToast.show("User data model not found");
        return;
      }

      var data = oModel.getData();
      console.log("🔍 Current user data:", data);

      if (!data || !Array.isArray(data)) {
        MessageToast.show("User data not loaded or invalid format. Please refresh the page.");
        return;
      }

      var foundUser = data.find(function(user) {
        return user.email && user.email.toLowerCase() === emailInput.toLowerCase()
          && user.password === passwordInput;
      });

      if (foundUser) {
        console.log("✅ Login successful for:", foundUser);

        // Salvează emailul în localStorage
        localStorage.setItem("savedEmail", emailInput);

        // Șterge orice model anterior și creează unul nou
        this.getOwnerComponent().setModel(null, "loggedUser");

        var userModel = new JSONModel({
          fullName: foundUser.fullName,
          email: foundUser.email,
          careerLevel: foundUser.careerLevel,
          serviceUnit: foundUser.serviceUnit,
          businessArea: foundUser.businessArea,
          personalNr: foundUser.personalNr,
          fiscalYear: foundUser.fiscalYear
        });

        this.getOwnerComponent().setModel(userModel, "loggedUser");

        MessageToast.show("Welcome, " + foundUser.fullName + "!");

        if (foundUser.role && foundUser.role.toLowerCase() === "manager") {
          this.getOwnerComponent().getRouter().navTo("ManagerDashboard");
        } else {
          this.getOwnerComponent().getRouter().navTo("UserDashboard");
        }
      } else {
        console.log("❌ Invalid credentials");
        MessageToast.show("Invalid email or password.");
      }
    },

    onForgotPassword: function () {
      this.getOwnerComponent().getRouter().navTo("ForgotPassword");
    },
    
    onTogglePasswordVisibility: function () {
      const oPasswordInput = this.byId("passwordInput");
      const currentType = oPasswordInput.getType();
      oPasswordInput.setType(currentType === "Password" ? "Text" : "Password");
    }
  });
});
