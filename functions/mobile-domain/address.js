// Generated from wala-mobile. Regenerate with export-payment-domain.mjs.
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.provinces = exports.departments = exports.EMPTY_ADDRESS = void 0;
exports.districts = districts;
exports.cleanAddress = cleanAddress;
exports.changeAddress = changeAddress;
exports.addressErrors = addressErrors;
exports.assertAddress = assertAddress;
exports.addressLocation = addressLocation;
const countries_json_1 = __importDefault(require("./countries.json"));
const peru_ubigeo_json_1 = __importDefault(require("./peru-ubigeo.json"));
const app_error_1 = require("./app-error");
exports.EMPTY_ADDRESS = { customerName: '', docType: 'DNI', dni: '', phone: '', country: 'PE', city: 'Lima', department: '', province: '', district: '', address: '' };
const locations = peru_ubigeo_json_1.default;
const normal = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
exports.departments = Object.keys(locations).filter((dep) => dep !== 'Callao').sort((a, b) => a.localeCompare(b, 'es'));
const provinces = (dep) => Object.keys(locations[dep] ?? {}).filter((name) => !(dep === 'Lima' && name === 'Lima'));
exports.provinces = provinces;
function districts(d) {
    if (d.country !== 'PE')
        return [];
    if (d.city === 'Callao')
        return locations.Callao.Callao;
    if (d.city === 'Lima')
        return locations.Lima.Lima;
    return locations[d.department]?.[d.province] ?? [];
}
function cleanAddress(value) {
    const d = Object.fromEntries(Object.entries(exports.EMPTY_ADDRESS).map(([key]) => [key, String(value[key] ?? '').trim()]));
    d.country = d.country.toUpperCase();
    if (d.country !== 'PE') {
        d.city = '';
        d.department = '';
        d.docType = 'OTRO';
    }
    else {
        if (d.city !== 'Provincias') {
            d.department = '';
            d.province = '';
        }
        d.district = districts(d).find((name) => normal(name) === normal(d.district)) ?? d.district;
    }
    return d;
}
function changeAddress(current, field, value) {
    const next = { ...current, [field]: value };
    if (field === 'country' && current.country !== value)
        Object.assign(next, { city: value === 'PE' ? 'Lima' : '', department: '', province: '', district: '', docType: value === 'PE' ? 'DNI' : 'OTRO' });
    if (field === 'city')
        Object.assign(next, { department: '', province: '', district: '' });
    if (field === 'department')
        Object.assign(next, { province: '', district: '' });
    if (field === 'province' && next.country === 'PE')
        next.district = '';
    return next;
}
function addressErrors(input, email) {
    const d = cleanAddress(input);
    const e = {};
    if (!d.customerName || d.customerName.length > 120)
        e.customerName = 'Escribe el nombre de quien recibe (hasta 120 caracteres).';
    if (!['DNI', 'CE', 'Pasaporte', 'OTRO'].includes(d.docType) || (d.country === 'PE' && d.docType === 'OTRO'))
        e.docType = 'Elige el tipo de documento.';
    if (d.dni.length < 3 || d.dni.length > 30)
        e.dni = 'Escribe un documento válido (de 3 a 30 caracteres).';
    if (!d.phone || d.phone.length > 25)
        e.phone = 'Escribe el teléfono de contacto (hasta 25 caracteres).';
    if (!countries_json_1.default.some((country) => country.code === d.country))
        e.country = 'Elige un país de la lista.';
    if (d.country === 'PE') {
        if (!['Lima', 'Callao', 'Provincias'].includes(d.city))
            e.city = 'Elige la ciudad o región.';
        if (d.city === 'Provincias') {
            if (!exports.departments.includes(d.department))
                e.department = 'Elige un departamento.';
            if (!(0, exports.provinces)(d.department).includes(d.province))
                e.province = 'Elige una provincia del departamento.';
        }
        if (!districts(d).some((district) => normal(district) === normal(d.district)))
            e.district = 'Elige un distrito del lugar seleccionado.';
    }
    else {
        if (!d.province || d.province.length > 120)
            e.province = 'Escribe la región o estado.';
        if (!d.district || d.district.length > 120)
            e.district = 'Escribe la ciudad.';
    }
    if (!d.address || d.address.length > 600)
        e.address = 'Escribe la dirección exacta (hasta 600 caracteres).';
    if (email !== undefined && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))
        e.email = 'Escribe un correo válido para el pedido.';
    return e;
}
function assertAddress(address, email) {
    if (Object.keys(addressErrors(address, email)).length)
        throw new app_error_1.AppError('validation', 'Revisa los datos del destinatario y la dirección antes de continuar.');
}
function addressLocation(d) {
    const country = countries_json_1.default.find((country) => country.code === d.country)?.name ?? d.country;
    return (d.country !== 'PE' ? [d.district, d.province, country] : d.city === 'Provincias'
        ? [d.district, d.province, d.department] : [d.district, d.city === 'Lima' ? 'Lima Metropolitana' : 'Callao']).filter(Boolean).join(', ');
}
