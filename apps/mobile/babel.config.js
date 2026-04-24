module.exports = (api) => {
  api.cache(true);
  process.env.EXPO_ROUTER_APP_ROOT = '../../app';
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'transform-inline-environment-variables',
        {
          include: ['EXPO_ROUTER_APP_ROOT', 'EXPO_ROUTER_IMPORT_MODE'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
