module.exports = {
  plugins: [
    "@babel/plugin-proposal-class-properties",
    [
      "@babel/plugin-transform-react-jsx",
      {
        pragma: "h"
      }
    ]
  ],
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          electron: "2.0.0"
        }
      }
    ]
  ]
};
