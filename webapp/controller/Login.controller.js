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
      // Modelul userData este deja configurat în manifest.json
      var oModel = this.getOwnerComponent().getModel("userData");
      if (oModel) {
        console.log("✅ userData model found from manifest");
        // Verifică dacă datele s-au încărcat
        var fnCheckData = function() {
          var data = oModel.getData();
          if (data && data.email) {
            console.log("✅ User data loaded:", data);
            MessageToast.show("✅ User data loaded successfully!");
          } else {
            console.log("⏳ Waiting for data to load...");
            setTimeout(fnCheckData, 100); // Încearcă din nou după 100ms
          }
        };
        fnCheckData();
        // Setează modelul pe view pentru acces local
        this.getView().setModel(oModel, "userData");
      } else {
        console.error("❌ userData model not found in manifest");
        MessageToast.show("❌ User data model not configured properly");
      }
    },

    clearInputs: function () {
      try {
        // Golește doar parola, nu și emailul
        this.byId("passwordInput").setValue("");
      } catch (e) {}
    },

    onLogin: function () {
      var emailInput = this.byId("emailInput").getValue().trim();
      var passwordInput = this.byId("passwordInput").getValue().trim();

      if (!emailInput || !passwordInput) {
        MessageToast.show("Please enter both email and password.");
        return;
      }

      // Încearcă să obții modelul din component sau view
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

      // Caută utilizatorul cu email și parolă potrivite
      var foundUser = data.find(function(user) {
        return user.email && user.email.toLowerCase() === emailInput.toLowerCase() && user.password === passwordInput;
      });

      if (foundUser) {
        console.log("✅ Login successful for:", foundUser);
        var userModel = new JSONModel({
          fullName: foundUser.fullName,
          email: foundUser.email,
          careerLevel: foundUser.careerLevel,
          serviceUnit: foundUser.serviceUnit,
          businessArea: foundUser.businessArea
        });
        this.getOwnerComponent().setModel(userModel, "loggedUser");
        MessageToast.show("Welcome, " + foundUser.fullName + "!");
        // Navigare în funcție de rol
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