sap.ui.define([
    "sap/ui/core/UIComponent",
    "fbtool/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("fbtool.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init: function () {
            // Apelăm init-ul din superclasă
            UIComponent.prototype.init.apply(this, arguments);

            // Model pentru device
            this.setModel(models.createDeviceModel(), "device");

            // Încarcă userData ca model "user"
            const oUserModel = new sap.ui.model.json.JSONModel();
            oUserModel.loadData("model/userData.json");
            this.setModel(oUserModel, "user");

            // Încarcă userul logat ca model "loggedUser"
            const oLoggedUserModel = new sap.ui.model.json.JSONModel({
                fullName: "ALEX POPESCU",
                email: "alex.popescu@example.com",
                role: "manager"
            });
            this.setModel(oLoggedUserModel, "loggedUser");

            // Simulează echipa managerului ca model "teamMembers"
            const oTeamModel = new sap.ui.model.json.JSONModel({
                teamMembers: [
                    { email: "maria.ionescu@example.com", name: "Maria Ionescu" },
                    { email: "stefania-maria.maracine@mhp.com", name: "Stefania Maracine" }
                    // Poți adăuga și alții
                ]
            });
            this.setModel(oTeamModel, "teamMembers");

            // Pornește routing
            this.getRouter().initialize();
        }
    });
});
