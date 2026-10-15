package com.gamehub.infrastructure;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {
    public static final String EXCHANGE = "game.events";
    public static final String QUEUE = "game.search.index";
    public static final String DEAD_LETTER_EXCHANGE = "game.events.dlx";
    public static final String DEAD_LETTER_QUEUE = "game.search.index.dlq";
    public static final String DEAD_LETTER_ROUTING_KEY = "game.search.index.failed";

    @Bean
    TopicExchange gameExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    DirectExchange gameDeadLetterExchange() {
        return new DirectExchange(DEAD_LETTER_EXCHANGE, true, false);
    }

    @Bean
    Queue searchQueue() {
        return QueueBuilder.durable(QUEUE)
                .deadLetterExchange(DEAD_LETTER_EXCHANGE)
                .deadLetterRoutingKey(DEAD_LETTER_ROUTING_KEY)
                .build();
    }

    @Bean
    Queue searchDeadLetterQueue() {
        return QueueBuilder.durable(DEAD_LETTER_QUEUE).build();
    }

    @Bean
    Binding searchBinding(Queue searchQueue, TopicExchange gameExchange) {
        return BindingBuilder.bind(searchQueue).to(gameExchange).with("game.*");
    }

    @Bean
    Binding searchDeadLetterBinding(Queue searchDeadLetterQueue, DirectExchange gameDeadLetterExchange) {
        return BindingBuilder.bind(searchDeadLetterQueue).to(gameDeadLetterExchange).with(DEAD_LETTER_ROUTING_KEY);
    }

    @Bean
    Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
