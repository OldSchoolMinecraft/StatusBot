// Import required libraries
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { connect } from 'net';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Discord bot setup
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Minecraft server details
const serverHost = process.env.MC_SERVER_HOST || 'your.minecraft.server';
const serverPort = parseInt(process.env.MC_SERVER_PORT) || 25565;
const channelId = process.env.DISCORD_CHANNEL_ID || 'your_channel_id';
const username = process.env.MC_USERNAME || 'BotUser';

// Function to send handshake packet and check server status
async function checkServerStatus() {
    return new Promise((resolve, reject) => {
        const socket = connect(serverPort, serverHost, () => {
            // Handshake packet (ID 0x02 with username)
            const usernameLength = Buffer.byteLength(username, 'utf8');
            const packetLength = 1 + usernameLength; // Packet ID + Username length
            const packet = Buffer.alloc(1 + packetLength); // Packet size + Packet content
            
            packet.writeUInt8(0x02, 0); // Packet ID (0x02)
            packet.writeUInt8(usernameLength, 1); // Username length
            packet.write(username, 2); // Username

            socket.write(packet);

            socket.on('data', () => {
                // If response is received, close the connection and resolve with "online"
                socket.destroy();
                resolve(true);
            });

            socket.on('error', () => {
                // On error, reject with "offline"
                reject(false);
            });
        });

        // Set a timeout for the connection
        socket.setTimeout(5000, () => {
            socket.destroy();
            reject(false);
        });
    });
}

// Function to update the Discord channel embed
async function updateServerStatus() {
    try {
        const isOnline = await checkServerStatus();
        const statusEmbed = new EmbedBuilder()
            .setTitle('Minecraft Server Status')
            .setColor(isOnline ? 0x00FF00 : 0xFF0000)
            .setDescription(isOnline ? '🟢 Server is online!' : '🔴 Server is offline.')
            .setTimestamp();

        const channel = await client.channels.fetch(channelId);
        const message = await channel.messages.fetch({ limit: 1 });
        if (message.size > 0) {
            await message.first().edit({ embeds: [statusEmbed] });
        } else {
            await channel.send({ embeds: [statusEmbed] });
        }
    } catch (error) {
        console.error('Failed to check server status:', error);
    }
}

// Discord bot login and event handling
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    updateServerStatus();
    setInterval(updateServerStatus, 60000); // Update every minute
});

client.login(process.env.DISCORD_TOKEN);
