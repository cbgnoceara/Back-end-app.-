require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt"); // Adicionado para criptografar senhas
const app = express();

app.use(cors());
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

// Modelo de reserva
const ReservaSchema = new mongoose.Schema({
  sala: String,
  data: String, // formato: "YYYY-MM-DD"
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
  criadoEm: { type: Date, default: Date.now }
});

const Reserva = mongoose.model("Reserva", ReservaSchema);

// Rota para reservar sala
app.post("/reservar", async (req, res) => {
  const { sala, data, usuarioId } = req.body;

  if (!sala || !data || !usuarioId) {
    return res.status(400).json({ message: "Dados incompletos." });
  }

  try {
    const hoje = new Date().toISOString().split("T")[0];
    await Reserva.deleteMany({ data: { $lt: hoje } });

    const reservaExistente = await Reserva.findOne({ sala, data });
    if (reservaExistente) {
      return res.status(409).json({ message: "Sala já reservada para esse dia." });
    }

    const novaReserva = new Reserva({ sala, data, usuarioId });
    await novaReserva.save();

    res.status(201).json({ message: "Reserva criada com sucesso!" });
  } catch (err) {
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

// Rota para listar reservas por data (com apelido do usuário)
app.get("/reservas/:data", async (req, res) => {
  const { data } = req.params;

  try {
    const reservas = await Reserva.find({ data }).populate("usuarioId", "apelido");
    res.status(200).json(reservas);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar reservas", erro: err.message });
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

// DELETE - Excluir um usuário
app.delete("/usuarios/:id", async (req, res) => {
  try {
    await Usuario.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Usuário excluído com sucesso." });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir usuário." });
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

// Ping automático a cada 3 minutos para evitar inatividade no Render
const fetch = require("node-fetch");

setInterval(() => {
  fetch("https://reserva-salas-backend.onrender.com") 
    .then(() => console.log("Ping enviado para manter o servidor ativo"))
    .catch(err => console.error("Erro ao enviar ping:", err.message));
}, 3 * 60 * 1000); // 3 minutos


// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
