module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: false }]],
    // Keep plugin last; nested worklets required by Reanimated's own initializers.
    plugins: [['react-native-reanimated/plugin', { processNestedWorklets: true }]],
  };
};
