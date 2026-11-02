import { createContext, useContext } from './libs.js';
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
