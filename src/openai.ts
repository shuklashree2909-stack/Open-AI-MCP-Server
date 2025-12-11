import axios from "axios";

const API_KEY = process.env.OPENAI_API_KEY!;
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

export async function openaiRequest(method: "GET" | "POST", path: string, body?: any) {
    const url = `${BASE_URL}${path}`;

    const res = await axios({
        method,
        url,
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
        },
        data: body,
    });

    return res.data;
}
