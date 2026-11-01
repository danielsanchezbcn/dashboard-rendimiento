import { createContext, useContext } from '../../vendor/libs.js';
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
