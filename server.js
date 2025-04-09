require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const app = express();


app.use(cors({
  origin: 'https://front-end-igreja.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// Conexão com o MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Conectado ao MongoDB"))
  .catch((err) => console.error("Erro ao conectar ao MongoDB:", err));

// Modelo do usuário
const UsuarioSchema = new mongoose.Schema({
  apelido: String,
  email: String,
  senha: String
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);

// ALTERAÇÃO NO SCHEMA (pode manter os antigos se quiser exibir no front)
const ReservaSchema = new mongoose.Schema({
  sala: String,
  dataInicio: Date,
  dataFim: Date,
  horarioInicio: String,
  horarioFim: String,
  finalidade: String,
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
  dataHoraInicio: Date,
  dataHoraFim: Date,
  criadoEm: { type: Date, default: Date.now }
});

const Reserva = mongoose.model("Reserva", ReservaSchema);

// Rota para reservar sala com verificação de conflito por data/hora
app.post("/reservar", async (req, res) => {
  const {
    sala,
    dataInicio,
    dataFim,
    horarioInicio,
    horarioFim,
    finalidade,
    usuarioId,
  } = req.body;

  if (!sala || !dataInicio || !dataFim || !horarioInicio || !horarioFim || !usuarioId) {
    return res.status(400).json({ message: "Dados incompletos." });
  }

  try {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
  
    // Montar objetos Date completos com data + hora
    function criarDataLocal(dataStr, horaStr) {
      const [ano, mes, dia] = dataStr.split('-').map(Number);
      const [hora, minuto] = horaStr.split(':').map(Number);
      return new Date(ano, mes - 1, dia, hora, minuto); // mês começa do 0
    }
    
    const dataInicioFull = criarDataLocal(dataInicio, horarioInicio);
    const dataFimFull = criarDataLocal(dataFim, horarioFim);    
  
    // Limpar reservas antigas (opcional)
    const hoje = new Date();
    await Reserva.deleteMany({ dataFim: { $lt: hoje } });
  
    // Verificar conflitos
    const conflitos = await Reserva.find({
      sala,
      $or: [
        {
          dataHoraInicio: { $lt: dataFimFull },
          dataHoraFim: { $gt: dataInicioFull }
        }
      ]
    });
  
    if (conflitos.length > 0) {
      return res.status(400).json({ message: "Conflito com outra reserva." });
    }
  
    const novaReserva = new Reserva({
      sala,
      dataInicio: inicio,
      dataFim: fim,
      horarioInicio,
      horarioFim,
      finalidade,
      usuarioId,
      dataHoraInicio: dataInicioFull,
      dataHoraFim: dataFimFull
    });

    await novaReserva.save();

    res.status(201).json({ message: "Reserva criada com sucesso!" });
  } catch (err) {
    console.error("Erro ao reservar:", err);
    res.status(500).json({ message: "Erro ao criar reserva", erro: err.message });
  }
});

// Rota para listar todas as reservas com dados do usuário
app.get("/reservas", async (req, res) => {
  try {
    const reservas = await Reserva.find().populate("usuarioId", "apelido email");
    res.status(200).json(reservas);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar reservas", erro: err.message });
  }
});

// Rota para listar reservas por data (verifica intervalo)
app.get("/reservas/:data", async (req, res) => {
  const { data } = req.params;

  try {
    const dataRef = new Date(data);
    const reservas = await Reserva.find({
      dataInicio: { $lte: dataRef },
      dataFim: { $gte: dataRef }
    }).populate("usuarioId", "apelido");

    res.status(200).json(reservas);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar reservas", erro: err.message });
  }
});

// Rota para deletar reserva com verificação de usuário
app.delete("/reservas/:id", async (req, res) => {
  const { usuarioId } = req.body;

  try {
    const reserva = await Reserva.findById(req.params.id);

    if (!reserva) {
      return res.status(404).json({ message: "Reserva não encontrada." });
    }

    if (reserva.usuarioId.toString() !== usuarioId) {
      return res.status(403).json({ message: "Você não tem permissão para excluir essa reserva." });
    }

    await Reserva.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Reserva excluída com sucesso." });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir reserva." });
  }
});

// CREATE - Cadastrar novo usuário com senha criptografada
app.post("/cadastro", async (req, res) => {
  const { apelido, email, senha } = req.body;

  try {
    const senhaCriptografada = await bcrypt.hash(senha, 10);

    const novoUsuario = new Usuario({
      apelido,
      email,
      senha: senhaCriptografada
    });

    await novoUsuario.save();
    res.status(201).json({ message: "Usuário cadastrado com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao cadastrar usuário." });
  }
});

// READ - Obter todos os usuários
app.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.status(200).json(usuarios);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar usuários." });
  }
});

// UPDATE - Editar um usuário
app.put("/usuarios/:id", async (req, res) => {
  try {
    const usuarioAtualizado = await Usuario.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json(usuarioAtualizado);
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

// LOGIN - Comparar senha criptografada
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(401).json({ message: "Email ou senha inválidos." });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ message: "Email ou senha inválidos." });
    }

    res.status(200).json({
      _id: usuario._id,
      apelido: usuario.apelido,
      email: usuario.email
    });
  } catch (err) {
    res.status(500).json({ message: "Erro no servidor", erro: err.message });
  }
});

// Ping automático para manter servidor ativo
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

setInterval(() => {
  fetch("https://reserva-salas-backend.onrender.com")
    .then(() => console.log("Ping enviado para manter o servidor ativo"))
    .catch(err => console.error("Erro ao enviar ping:", err.message));
}, 3 * 60 * 1000);

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
