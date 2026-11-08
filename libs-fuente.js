// Punto de entrada del paquete de librerías de terceros (se compila una vez; el resultado se guarda como libs.js).
import { h, render, Fragment, Component, createContext } from 'preact';
import { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer } from 'preact/hooks';
import htm from 'htm';
import Dexie from 'dexie';
import readXlsx from 'read-excel-file/universal';
import { Chart, LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';

// Solo lo necesario (líneas, puntos y barras): el resto de Chart.js no entra en el paquete (D20).
Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend);

const html = htm.bind(h);

export { h, render, Fragment, Component, createContext, useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer, html, Dexie, readXlsx, Chart };
