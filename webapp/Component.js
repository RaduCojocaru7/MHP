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

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        },

                init: function () {
                    UIComponent.prototype.init.apply(this, arguments);

            // Model pentru datele userului
            var oUserModel = new sap.ui.model.json.JSONModel();
            oUserModel.loadData("model/userData.json");
            this.setModel(oUserModel, "user");

            this.getRouter().initialize();
        }
    });
});