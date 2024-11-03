export interface User {
    uid: string,
    email: string,
    password: string,
    name: string,
    role: 'admin' | 'planillero' | 'usuario',  // Definir tipos específicos
    image: string
}