// Punto de entrada del paquete de librerías de terceros (se compila una vez; el resultado se guarda como libs.js).
import { h, render, Fragment, Component, createContext } from 'preact';
import { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer } from 'preact/hooks';
import htm from 'htm';
import Dexie from 'dexie';
import readXlsx from 'read-excel-file/universal';

const html = htm.bind(h);

export { h, render, Fragment, Component, createContext, useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer, html, Dexie, readXlsx };
