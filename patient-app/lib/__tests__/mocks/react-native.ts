export const Platform = {
  OS: 'ios',
  select: <T,>(spec: { ios?: T; android?: T; default?: T }) => spec.ios ?? spec.default,
};

export default { Platform };
