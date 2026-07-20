export default {
  routes: [
    {
      method: "POST",
      path: "/product-records/assign-owner",
      handler: "product-record.assignOwner",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
